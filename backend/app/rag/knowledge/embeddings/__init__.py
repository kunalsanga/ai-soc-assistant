"""Embedding providers for the knowledge pipeline.

Two providers behind one interface (spec Step 8):
- local-hashing (default): deterministic, dependency-free, offline — for
  development and reproducible tests. NOT semantically meaningful.
- semantic: real sentence-transformers embeddings loaded locally
  (e.g. all-MiniLM-L6-v2, 384-dim). Selected via EMBEDDING_PROVIDER=semantic.

Use build_embedding_provider() to construct the provider from settings so the
pipeline, Qdrant index, and Retriever never depend on a concrete class.
"""
from .base import (
    DimensionMismatchError,
    EmbeddingError,
    EmbeddingProvider,
)
from .hashing import HashingEmbeddingProvider
from .semantic import SemanticEmbeddingProvider


def build_embedding_provider():
    """Construct the configured EmbeddingProvider from app settings.

    EMBEDDING_PROVIDER=local-hashing (default) → deterministic hashing.
    EMBEDDING_PROVIDER=semantic → local sentence-transformers model named by
    SEMANTIC_EMBEDDING_MODEL (default all-MiniLM-L6-v2).
    """
    from app.core.config import settings

    provider_kind = (settings.EMBEDDING_PROVIDER or "local-hashing").strip().lower()
    if provider_kind == "semantic":
        return SemanticEmbeddingProvider(model_id=settings.SEMANTIC_EMBEDDING_MODEL)
    if provider_kind in ("local-hashing", "hashing", ""):
        return HashingEmbeddingProvider(dimension=settings.EMBEDDING_DIMENSION)
    raise EmbeddingError(
        f"Unknown EMBEDDING_PROVIDER '{settings.EMBEDDING_PROVIDER}' — "
        "expected 'local-hashing' or 'semantic'"
    )


__all__ = [
    "DimensionMismatchError",
    "EmbeddingError",
    "EmbeddingProvider",
    "HashingEmbeddingProvider",
    "SemanticEmbeddingProvider",
    "build_embedding_provider",
]
