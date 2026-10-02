"""Deterministic knowledge chunking (spec Step 7).

Design:
- paragraph-aware splitting: chunks break at blank-line boundaries when
  possible (semantic boundaries), falling back to word boundaries, so MITRE
  technique metadata (description sections, detection guidance) stays
  associated with its technique rather than being cut mid-sentence blindly.
- every chunk carries full provenance (source, document, url, title) and a
  stable chunk id: "{document_id}::{chunk_index}" — deterministic across
  runs, rebuilds, and machines.
- configuration: chunk_size (chars) and chunk_overlap (chars), validated.

A chunk is always traceable back to its document (chunk_id embeds
document_id; metadata carries document-level provenance).
"""
from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from typing import List

from app.rag.knowledge.schemas import KnowledgeChunk, KnowledgeDocument

logger = logging.getLogger(__name__)

_MIN_CHUNK_SIZE = 100
_MAX_CHUNK_SIZE = 8000
_MIN_OVERLAP = 0
_DEFAULT_CHUNK_SIZE = 1200
_DEFAULT_CHUNK_OVERLAP = 150


@dataclass(frozen=True)
class ChunkingConfig:
    chunk_size: int = _DEFAULT_CHUNK_SIZE
    chunk_overlap: int = _DEFAULT_CHUNK_OVERLAP

    def __post_init__(self) -> None:
        if self.chunk_size < _MIN_CHUNK_SIZE or self.chunk_size > _MAX_CHUNK_SIZE:
            raise ValueError(
                f"chunk_size must be between {_MIN_CHUNK_SIZE} and {_MAX_CHUNK_SIZE}"
            )
        if self.chunk_overlap < _MIN_OVERLAP or self.chunk_overlap >= self.chunk_size:
            raise ValueError(
                f"chunk_overlap must be >= 0 and < chunk_size "
                f"({self.chunk_size})"
            )


def _split_paragraphs(content: str) -> List[str]:
    """Split on blank lines; merge single newlines inside a paragraph."""
    paragraphs: List[str] = []
    for block in content.split("\n\n"):
        block = " ".join(line.strip() for line in block.split("\n")).strip()
        if block:
            paragraphs.append(block)
    return paragraphs


def _stable_tail(content: str, size: int) -> str:
    """Take the last `size` chars on a word boundary (for overlap windows)."""
    if len(content) <= size:
        return content
    tail = content[-size:]
    space = tail.find(" ")
    return tail[space + 1:] if space != -1 else tail


class Chunker:
    """Configurable, deterministic document chunker."""

    def __init__(self, config: ChunkingConfig | None = None) -> None:
        self._config = config or ChunkingConfig()

    @property
    def config(self) -> ChunkingConfig:
        return self._config

    def chunk_document(self, document: KnowledgeDocument) -> List[KnowledgeChunk]:
        """Chunk one document into provenance-preserving KnowledgeChunks."""
        doc = document
        base_metadata = {
            "document_type": doc.document_type,
            **{f"doc_{k}": v for k, v in doc.metadata.items()},
        }

        chunks: List[KnowledgeChunk] = []
        for content in self._iter_chunk_texts(doc.content):
            index = len(chunks)
            chunk_id = f"{doc.document_id}::{index}"
            chunks.append(
                KnowledgeChunk(
                    chunk_id=chunk_id,
                    document_id=doc.document_id,
                    source=doc.source,
                    source_identifier=doc.source_identifier,
                    source_url=doc.source_url,
                    title=doc.title,
                    chunk_index=index,
                    content=content,
                    metadata=dict(base_metadata),
                )
            )

        logger.info(
            "document_chunked document_id=%s chunks=%d chunk_size=%d overlap=%d",
            doc.document_id,
            len(chunks),
            self._config.chunk_size,
            self._config.chunk_overlap,
        )
        return chunks

    def chunk_documents(self, documents: List[KnowledgeDocument]) -> List[KnowledgeChunk]:
        """Chunk a document batch, preserving deterministic order."""
        all_chunks: List[KnowledgeChunk] = []
        for document in documents:
            all_chunks.extend(self.chunk_document(document))
        logger.info("batch_chunked documents=%d chunks=%d", len(documents), len(all_chunks))
        return all_chunks

    # -- internals ----------------------------------------------------------

    def _iter_chunk_texts(self, content: str) -> List[str]:
        size = self._config.chunk_size
        overlap = self._config.chunk_overlap
        paragraphs = _split_paragraphs(content)
        if not paragraphs:
            return []

        windows: List[str] = []
        current: List[str] = []
        current_len = 0

        def flush() -> None:
            nonlocal current, current_len
            if current:
                windows.append(" ".join(current))
                current, current_len = [], 0

        for paragraph in paragraphs:
            # A single oversized paragraph is split on word boundaries.
            if len(paragraph) > size:
                flush()
                start = 0
                while start < len(paragraph):
                    end = min(start + size, len(paragraph))
                    if end < len(paragraph):
                        space = paragraph.rfind(" ", start, end)
                        if space > start:
                            end = space
                    piece = paragraph[start:end].strip()
                    if piece:
                        windows.append(piece)
                    if end >= len(paragraph):
                        break
                    start = max(end - overlap, start + 1)
                continue

            if current_len + len(paragraph) + (1 if current else 0) > size:
                flush()
                if overlap and windows:
                    # Carry an overlap tail from the previous window.
                    tail = _stable_tail(windows[-1], overlap)
                    if tail:
                        current.append(tail)
                        current_len = len(tail)
            current.append(paragraph)
            current_len += len(paragraph) + (1 if current_len else 0)

        flush()
        return [w for w in windows if w.strip()]
