"""Knowledge base package: ingestion, chunking, embeddings, vector storage.

Phase 4A boundary: ends at chunks → embeddings → Qdrant index.
Retrieval is Phase 4B. Knowledge is data, not instructions.

Public surface:
- KnowledgeDocument / KnowledgeChunk (schemas)
- KnowledgeSource + MitreAttackSource / NvdCveSource (adapters)
- normalize_documents, Chunker, EmbeddingProvider / HashingEmbeddingProvider
- QdrantIndex, KnowledgeIngestionPipeline

Usage (explicit operation, never auto-run at app startup):
    pipeline = KnowledgeIngestionPipeline(index=QdrantIndex(...))
    result = pipeline.run([MitreAttackSource(path), NvdCveSource(path)])
"""
from .chunking import Chunker, ChunkingConfig
from .embeddings import (
    EmbeddingProvider,
    HashingEmbeddingProvider,
)
from .normalize import normalize_document, normalize_documents
from .pipeline import IngestionResult, KnowledgeIngestionPipeline
from .schemas import KnowledgeChunk, KnowledgeDocument, KnowledgeProvenance
from .sources import KnowledgeSource, MitreAttackSource, NvdCveSource
from .vectorstore import QdrantIndex

__all__ = [
    "Chunker",
    "ChunkingConfig",
    "EmbeddingProvider",
    "HashingEmbeddingProvider",
    "IngestionResult",
    "KnowledgeChunk",
    "KnowledgeDocument",
    "KnowledgeIngestionPipeline",
    "KnowledgeProvenance",
    "KnowledgeSource",
    "MitreAttackSource",
    "NvdCveSource",
    "QdrantIndex",
    "normalize_document",
    "normalize_documents",
]
