"""Knowledge ingestion pipeline (spec Step 10).

    KnowledgeSource → load() → normalize → dedupe → chunk → embed → Qdrant

Callable programmatically; never runs on application startup — indexing is
an explicit operation (e.g. from scripts/ or a maintenance task). Batch
processing with per-source failure reporting; sources that fail produce an
error entry, not a crashed pipeline.
"""
from __future__ import annotations

import logging
import time
from typing import Dict, List, Sequence, Tuple

from app.rag.knowledge.chunking import Chunker
from app.rag.knowledge.embeddings.base import EmbeddingProvider
from app.rag.knowledge.normalize import normalize_documents
from app.rag.knowledge.schemas import KnowledgeChunk, KnowledgeDocument
from app.rag.knowledge.sources.base import KnowledgeSource, KnowledgeSourceError
from app.rag.knowledge.vectorstore.qdrant import QdrantIndex, VectorStoreError

logger = logging.getLogger(__name__)


class IngestionResult:
    """Outcome summary for one ingestion run."""

    def __init__(self) -> None:
        self.documents_per_source: Dict[str, int] = {}
        self.chunks_per_source: Dict[str, int] = {}
        self.indexed_chunks: int = 0
        self.rejected_records: List[str] = []
        self.source_errors: List[str] = []
        self.duration_seconds: float = 0.0

    @property
    def ok(self) -> bool:
        return not self.source_errors

    def summary(self) -> Dict[str, object]:
        return {
            "ok": self.ok,
            "documents_per_source": self.documents_per_source,
            "chunks_per_source": dict(self.chunks_per_source),
            "indexed_chunks": self.indexed_chunks,
            "rejected_records": self.rejected_records[:50],
            "source_errors": self.source_errors,
            "duration_seconds": round(self.duration_seconds, 2),
        }


class KnowledgeIngestionPipeline:
    """Composes source adapters, normalization, chunking, embedding, indexing."""

    def __init__(
        self,
        chunker: Chunker | None = None,
        embedding_provider: EmbeddingProvider | None = None,
        index: QdrantIndex | None = None,
    ) -> None:
        self._chunker = chunker or Chunker()
        self._provider = embedding_provider
        self._index = index

    # -- dependency wiring ----------------------------------------------------

    def _get_provider(self) -> EmbeddingProvider:
        if self._provider is None:
            from app.rag.knowledge.embeddings import HashingEmbeddingProvider

            self._provider = HashingEmbeddingProvider()
        return self._provider

    def _get_index(self) -> QdrantIndex:
        if self._index is None:
            from app.core.config import settings

            self._index = QdrantIndex(
                url=settings.QDRANT_URL,
                collection=settings.QDRANT_COLLECTION,
                embedding_provider=self._get_provider(),
                api_key=settings.QDRANT_API_KEY or None,
            )
        return self._index

    # -- stages (public for granular use/testing) -------------------------------

    def load_and_normalize(
        self, source: KnowledgeSource
    ) -> Tuple[List[KnowledgeDocument], List[str]]:
        """Load raw records, normalize them, and collect rejection reasons."""
        documents, errors = source.load()
        normalized, normalize_errors = normalize_documents(documents)
        return normalized, errors + normalize_errors

    def chunk(self, documents: Sequence[KnowledgeDocument]) -> List[KnowledgeChunk]:
        return self._chunker.chunk_documents(list(documents))

    def index(self, chunks: Sequence[KnowledgeChunk]) -> int:
        return self._get_index().upsert_chunks(list(chunks))

    # -- full run ------------------------------------------------------------------

    def run(
        self,
        sources: Sequence[KnowledgeSource],
        dedupe_documents: bool = True,
    ) -> IngestionResult:
        """Ingest all provided sources end-to-end.

        - empty sources / empty record sets are handled gracefully
        - duplicate document_ids: last-write-wins dedupe (deterministic,
          stable input order) so re-runs converge instead of duplicating
        - failures are collected and reported, never hidden
        """
        result = IngestionResult()
        started = time.perf_counter()

        all_documents: List[KnowledgeDocument] = []
        seen_ids: Dict[str, int] = {}

        for source in sources:
            try:
                documents, errors = self.load_and_normalize(source)
            except KnowledgeSourceError as exc:
                result.source_errors.append(f"{source.name}: {exc.message}")
                continue

            result.documents_per_source[source.name] = len(documents)
            result.rejected_records.extend(f"{source.name}: {e}" for e in errors)

            for position, document in enumerate(documents):
                if dedupe_documents and document.document_id in seen_ids:
                    logger.info(
                        "duplicate_document_replaced document_id=%s old_index=%d new_index=%d",
                        document.document_id,
                        seen_ids[document.document_id],
                        position,
                    )
                    all_documents[seen_ids[document.document_id]] = document
                else:
                    seen_ids[document.document_id] = len(all_documents)
                    all_documents.append(document)

        if not all_documents:
            logger.warning("ingestion_no_documents sources=%d", len(sources))
            result.duration_seconds = time.perf_counter() - started
            return result

        chunks = self.chunk(all_documents)
        result.chunks_per_source = {}
        for chunk in chunks:
            result.chunks_per_source[chunk.source] = (
                result.chunks_per_source.get(chunk.source, 0) + 1
            )

        try:
            result.indexed_chunks = self.index(chunks)
        except VectorStoreError as exc:
            result.source_errors.append(f"qdrant: {exc.message}")
            result.duration_seconds = time.perf_counter() - started
            return result

        result.duration_seconds = time.perf_counter() - started
        logger.info(
            "ingestion_complete documents=%d chunks=%d indexed=%d duration_s=%.2f",
            len(all_documents),
            len(chunks),
            result.indexed_chunks,
            result.duration_seconds,
        )
        return result
