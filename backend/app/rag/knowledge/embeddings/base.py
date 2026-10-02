"""EmbeddingProvider abstraction (spec Step 8).

The knowledge pipeline depends only on this interface; the concrete model is
a configuration choice. Implementations must be batch-capable and report a
fixed dimension. No secrets live in code — providers read configuration.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import List, Sequence


class EmbeddingError(Exception):
    """Base error for embedding failures."""


class DimensionMismatchError(EmbeddingError):
    """A provider returned vectors whose dimension differs from its declared one."""


class EmbeddingProvider(ABC):
    """Batch text embedding interface."""

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Stable model identifier recorded in the index metadata."""

    @property
    @abstractmethod
    def dimension(self) -> int:
        """Fixed vector dimension produced by this provider."""

    @abstractmethod
    def embed_texts(self, texts: Sequence[str]) -> List[List[float]]:
        """Embed a batch of texts, returning one vector per input, in order.

        Raises EmbeddingError on failure. Empty input returns [].
        """

    def embed_text(self, text: str) -> List[float]:
        """Convenience single-text embedding."""
        vectors = self.embed_texts([text])
        if len(vectors) != 1:
            raise DimensionMismatchError(
                f"expected 1 vector, provider returned {len(vectors)}"
            )
        return vectors[0]
