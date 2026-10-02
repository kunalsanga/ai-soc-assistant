"""Local hashing embedding provider — the deterministic development default.

Design notes:
- No network calls, no API cost, no model download: works fully offline.
- Deterministic: the same text always yields the same vector (spec Step 8).
- Implementation: character n-gram feature hashing into a fixed-dimension
  float vector, L2-normalized. This is NOT semantically equivalent to a
  trained embedding model — it exists so the pipeline is runnable and
  testable before a real embedding model (e.g. sentence-transformers) is
  configured. Swap via EmbeddingProvider without touching the pipeline.
- Model name is versioned so a future real provider produces distinguishable
  index metadata ("HashingEmbeddingProvider/ngram2-dim256-v1").
"""
from __future__ import annotations

import hashlib
import math
import re
from typing import List, Sequence

from app.rag.knowledge.embeddings.base import (
    DimensionMismatchError,
    EmbeddingError,
    EmbeddingProvider,
)

_TOKEN_RE = re.compile(r"[a-z0-9]+")
_NGRAM_SIZE = 2


class HashingEmbeddingProvider(EmbeddingProvider):
    """Feature-hashing embeddings; deterministic and dependency-free."""

    def __init__(self, dimension: int = 256) -> None:
        if dimension <= 0:
            raise ValueError("dimension must be positive")
        self._dimension = dimension

    @property
    def model_name(self) -> str:
        return f"HashingEmbeddingProvider/ngram{_NGRAM_SIZE}-dim{self._dimension}-v1"

    @property
    def dimension(self) -> int:
        return self._dimension

    def embed_texts(self, texts: Sequence[str]) -> List[List[float]]:
        if not texts:
            return []
        vectors: List[List[float]] = []
        for text in texts:
            if not isinstance(text, str):
                raise EmbeddingError("embed_texts expects strings")
            vectors.append(self._embed_one(text))
        return vectors

    def _embed_one(self, text: str) -> List[float]:
        vector = [0.0] * self._dimension
        tokens = _TOKEN_RE.findall(text.lower())
        if not tokens:
            # Deterministic neutral vector for empty text (unit vector at 0).
            vector[0] = 1.0
            return vector

        grams: List[str] = []
        for token in tokens:
            padded = f"^{token}$"
            for i in range(len(padded) - _NGRAM_SIZE + 1):
                grams.append(padded[i:i + _NGRAM_SIZE])
        if not grams:
            grams = tokens

        for gram in grams:
            digest = hashlib.md5(gram.encode("utf-8")).digest()
            # Two index/bucket values per gram: one positive, one negative
            # contribution, improving dispersion across the vector.
            index_a = int.from_bytes(digest[0:4], "big") % self._dimension
            index_b = int.from_bytes(digest[4:8], "big") % self._dimension
            sign = 1.0 if digest[8] % 2 == 0 else -1.0
            vector[index_a] += sign
            vector[index_b] -= sign

        norm = math.sqrt(sum(v * v for v in vector))
        if norm == 0:
            vector[0] = 1.0
            return vector
        return [v / norm for v in vector]


def _unused_guard() -> None:  # pragma: no cover
    """Reference imported names to keep linters satisfied about re-exports."""
    _ = DimensionMismatchError
