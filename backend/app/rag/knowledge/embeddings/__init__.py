"""Embedding providers for the knowledge pipeline.

Default: a deterministic local hashing embedding (no network, no cost, no
model download) suitable for development and reproducible tests. The
interface allows swapping in a sentence-transformers or API-backed provider
later without touching the pipeline (spec Step 8).
"""
from .base import (
    DimensionMismatchError,
    EmbeddingError,
    EmbeddingProvider,
)
from .hashing import HashingEmbeddingProvider

__all__ = [
    "DimensionMismatchError",
    "EmbeddingError",
    "EmbeddingProvider",
    "HashingEmbeddingProvider",
]
