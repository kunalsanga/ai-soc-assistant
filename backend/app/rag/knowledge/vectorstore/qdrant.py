"""Qdrant vector index for knowledge chunks (spec Step 9).

Indexing layer only — no search/retrieval here (Phase 4B owns that).

Design:
- client created lazily so importing/testing never requires a live Qdrant.
- stable point IDs: UUIDv5 over (collection, chunk_id) so re-indexing the
  same chunk overwrites its point instead of duplicating it.
- every point payload carries full provenance (source, document_id,
  source_identifier, source_url, chunk_id, title, model name) — the vector
  store is NOT opaque (spec Steps 13-14).
- collection is created with the configured embedding dimension and cosine
  distance; existing collections keep their dimension (mismatch → error).
"""
from __future__ import annotations

import logging
import time
import uuid
from typing import Any, Dict, List, Optional, Sequence

from app.rag.knowledge.embeddings.base import EmbeddingProvider
from app.rag.knowledge.schemas import KnowledgeChunk

logger = logging.getLogger(__name__)


def _models():
    """Return (Distance, VectorParams, PointStruct) from qdrant-client.

    When the optional dependency is absent (unit tests fake the client),
    minimal structural stand-ins are returned so payload/dimension logic
    stays exercised. Production always uses the real qdrant-client models.
    """
    try:
        from qdrant_client.models import Distance, PointStruct, VectorParams

        return Distance, VectorParams, PointStruct
    except ImportError:
        from dataclasses import dataclass, field

        class Distance:  # type: ignore[no-redef]
            COSINE = "cosine"  # namespace stand-in mirroring qdrant enum usage

        @dataclass
        class VectorParams:  # type: ignore[no-redef]
            size: int
            distance: object = None

        @dataclass
        class PointStruct:  # type: ignore[no-redef]
            id: str
            vector: List[float]
            payload: Dict[str, Any] = field(default_factory=dict)

        return Distance, VectorParams, PointStruct


class VectorStoreError(Exception):
    """Raised when vector-store operations fail."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class QdrantIndex:
    """Qdrant-backed index for KnowledgeChunks."""

    def __init__(
        self,
        url: str,
        collection: str,
        embedding_provider: EmbeddingProvider,
        api_key: Optional[str] = None,
        batch_size: int = 64,
    ) -> None:
        if not url:
            raise VectorStoreError("Qdrant URL is required (QDRANT_URL)")
        if not collection:
            raise VectorStoreError("Qdrant collection is required (QDRANT_COLLECTION)")
        self._url = url
        self._collection = collection
        self._provider = embedding_provider
        self._api_key = api_key
        self._batch_size = max(1, batch_size)
        self._client: Any = None  # QdrantClient, created lazily
        self._collection_ready = False

    # -- lifecycle -----------------------------------------------------------

    def _get_client(self) -> Any:
        if self._client is None:
            try:
                from qdrant_client import QdrantClient  # imported lazily: optional dep
            except ImportError as exc:
                raise VectorStoreError(
                    "qdrant-client is not installed; run pip install -r requirements.txt"
                ) from exc
            try:
                self._client = QdrantClient(url=self._url, api_key=self._api_key, timeout=30)
            except Exception as exc:  # noqa: BLE001
                raise VectorStoreError(f"Cannot create Qdrant client: {exc}") from exc
        return self._client

    def close(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None
            self._collection_ready = False

    # -- collection management -------------------------------------------------

    def ensure_collection(self) -> None:
        """Create the collection if missing; validate dimension if present."""
        client = self._get_client()
        Distance, VectorParams, _ = _models()
        try:
            existing_names = [c.name for c in client.get_collections().collections]
            if self._collection in existing_names:
                info = client.get_collection(self._collection)
                vector_size = None
                config = getattr(info, "config", None)
                params = getattr(config, "params", None) if config else None
                vectors = getattr(params, "vectors", None) if params else None
                vector_size = getattr(vectors, "size", None) if vectors else None
                if vector_size is not None and vector_size != self._provider.dimension:
                    raise VectorStoreError(
                        f"Collection '{self._collection}' has dimension {vector_size} "
                        f"but the embedding provider produces {self._provider.dimension}. "
                        "Use a different collection or reindex."
                    )
                self._collection_ready = True
                return

            client.create_collection(
                collection_name=self._collection,
                vectors_config=VectorParams(
                    size=self._provider.dimension,
                    distance=Distance.COSINE,
                ),
            )
            logger.info(
                "qdrant_collection_created collection=%s dimension=%d",
                self._collection,
                self._provider.dimension,
            )
            self._collection_ready = True
        except VectorStoreError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise VectorStoreError(f"Qdrant ensure_collection failed: {exc}") from exc

    # -- indexing ---------------------------------------------------------------

    @staticmethod
    def point_id_for(chunk_id: str) -> str:
        """Deterministic UUIDv5 point id for a chunk id (stable across runs)."""
        return str(uuid.uuid5(uuid.NAMESPACE_URL, f"soc-knowledge:{chunk_id}"))

    @staticmethod
    def build_payload(chunk: KnowledgeChunk, model_name: str) -> Dict[str, Any]:
        """Provenance-complete payload stored alongside each vector."""
        return {
            "chunk_id": chunk.chunk_id,
            "document_id": chunk.document_id,
            "source": chunk.source,
            "source_identifier": chunk.source_identifier,
            "source_url": chunk.source_url,
            "title": chunk.title,
            "chunk_index": chunk.chunk_index,
            "content": chunk.content,
            "model_name": model_name,
            "metadata": chunk.metadata,
        }

    def upsert_chunks(
        self,
        chunks: Sequence[KnowledgeChunk],
    ) -> int:
        """Embed and upsert chunks in batches. Returns number indexed."""
        if not chunks:
            return 0
        client = self._get_client()
        if not self._collection_ready:
            self.ensure_collection()

        _, _, PointStruct = _models()

        indexed = 0
        total = len(chunks)
        started = time.perf_counter()
        for batch_start in range(0, total, self._batch_size):
            batch = list(chunks[batch_start:batch_start + self._batch_size])
            texts = [c.content for c in batch]
            try:
                vectors = self._provider.embed_texts(texts)
            except Exception as exc:  # noqa: BLE001
                raise VectorStoreError(f"Embedding failed during upsert: {exc}") from exc

            if len(vectors) != len(batch):
                raise VectorStoreError(
                    f"Provider returned {len(vectors)} vectors for {len(batch)} chunks"
                )
            for vector in vectors:
                if len(vector) != self._provider.dimension:
                    raise VectorStoreError(
                        f"Provider vector dimension {len(vector)} != declared "
                        f"{self._provider.dimension}"
                    )

            points = [
                PointStruct(
                    id=self.point_id_for(chunk.chunk_id),
                    vector=vector,
                    payload=self.build_payload(chunk, self._provider.model_name),
                )
                for chunk, vector in zip(batch, vectors)
            ]
            try:
                client.upsert(collection_name=self._collection, points=points, wait=True)
            except Exception as exc:  # noqa: BLE001
                raise VectorStoreError(f"Qdrant upsert failed: {exc}") from exc

            indexed += len(batch)
            logger.info(
                "qdrant_batch_indexed collection=%s indexed=%d/%d",
                self._collection,
                indexed,
                total,
            )

        latency_ms = (time.perf_counter() - started) * 1000
        logger.info(
            "qdrant_upsert_complete collection=%s total=%d latency_ms=%.1f",
            self._collection,
            indexed,
            latency_ms,
        )
        return indexed

    def upsert_chunk(self, chunk: KnowledgeChunk) -> None:
        """Convenience single-chunk upsert."""
        self.upsert_chunks([chunk])

    def search(
        self,
        query_vector: List[float],
        top_k: int = 5,
        score_threshold: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """Search the collection for the closest vectors.
        
        Returns a list of dicts containing 'score' and 'payload'.
        """
        if not self._collection_ready:
            self.ensure_collection()
            
        client = self._get_client()
        
        try:
            response = client.query_points(
                collection_name=self._collection,
                query=query_vector,
                limit=top_k,
                score_threshold=score_threshold,
                with_payload=True,
            )
            
            # Extract score and payload to keep Qdrant types from leaking too much
            return [
                {
                    "score": hit.score,
                    "payload": hit.payload or {},
                }
                for hit in response.points
            ]
        except Exception as exc:  # noqa: BLE001
            raise VectorStoreError(f"Qdrant search failed: {exc}") from exc
