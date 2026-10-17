"""Semantic embedding provider — local sentence-transformers models.

Design:
- Same EmbeddingProvider interface as the hashing provider, so the pipeline,
  Qdrant index, and Retriever need no changes (spec Step 8 / Liskov swap).
- The model is loaded LAZILY on first embed call: importing this module or
  constructing the provider never downloads or loads anything (unit tests
  stay hermetic; production downloads the model once, then runs offline).
- Vectors are L2-normalized so Qdrant COSINE distance works as intended.
- Selected via EMBEDDING_PROVIDER=semantic; the model id comes from
  SEMANTIC_EMBEDDING_MODEL (default: sentence-transformers/all-MiniLM-L6-v2,
  22M params, 384-dim, ~90MB — small enough for laptop-local inference).
"""
from __future__ import annotations

import logging
from typing import Any, List, Sequence

from app.rag.knowledge.embeddings.base import (
    EmbeddingError,
    EmbeddingProvider,
)

logger = logging.getLogger(__name__)

_DEFAULT_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


class SemanticEmbeddingProvider(EmbeddingProvider):
    """Real semantic embeddings from a locally loaded transformer model."""

    def __init__(self, model_id: str = _DEFAULT_MODEL, device: str = "cpu") -> None:
        if not model_id or not model_id.strip():
            raise ValueError("model_id must be a non-empty HuggingFace model id")
        # Normalize: accept ids with or without the org prefix; always record
        # the full provenance name "sentence-transformers/<model>".
        normalized = model_id.strip()
        if normalized.startswith("sentence-transformers/"):
            normalized = normalized[len("sentence-transformers/"):]
        self._model_id = normalized
        self._device = device
        self._model: Any = None  # SentenceTransformer, loaded lazily
        self._dimension: int | None = None

    # -- lazy model lifecycle --------------------------------------------------

    def _get_model(self) -> Any:
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
            except ImportError as exc:
                raise EmbeddingError(
                    "sentence-transformers is not installed; "
                    "run pip install -r requirements.txt"
                ) from exc
            try:
                logger.info(
                    "semantic_embedding_model_loading model=%s device=%s",
                    self._model_id,
                    self._device,
                )
                self._model = SentenceTransformer(self._model_id, device=self._device)
                # transformers 5.x renamed the method; keep the old fallback.
                get_dim = getattr(
                    self._model, "get_embedding_dimension", None
                ) or self._model.get_sentence_embedding_dimension
                self._dimension = int(get_dim())
            except Exception as exc:  # noqa: BLE001
                self._model = None
                self._dimension = None
                raise EmbeddingError(
                    f"Failed to load semantic embedding model '{self._model_id}': {exc}"
                ) from exc
            logger.info(
                "semantic_embedding_model_loaded model=%s dimension=%d",
                self._model_id,
                self._dimension,
            )
        return self._model

    # -- EmbeddingProvider interface -------------------------------------------

    @property
    def model_name(self) -> str:
        return f"sentence-transformers/{self._model_id}"

    @property
    def dimension(self) -> int:
        # Force the lazy load so callers always get the true model dimension.
        if self._dimension is None:
            self._get_model()
        assert self._dimension is not None  # narrowed by _get_model
        return self._dimension

    def embed_texts(self, texts: Sequence[str]) -> List[List[float]]:
        if not texts:
            return []
        for text in texts:
            if not isinstance(text, str):
                raise EmbeddingError("embed_texts expects strings")

        model = self._get_model()
        try:
            import numpy as np

            vectors = model.encode(
                list(texts),
                batch_size=64,
                normalize_embeddings=True,  # cosine-ready unit vectors
                convert_to_numpy=True,
                show_progress_bar=False,
            )
        except Exception as exc:  # noqa: BLE001
            raise EmbeddingError(
                f"Semantic embedding failed for {len(texts)} text(s): {exc}"
            ) from exc

        # Defensive: shape/dtype validation before handing vectors downstream.
        expected = (len(texts), self.dimension)
        if vectors.shape != expected:
            raise EmbeddingError(
                f"Model returned vectors with shape {tuple(vectors.shape)}, "
                f"expected {expected}"
            )
        return [np.asarray(row, dtype=float).tolist() for row in vectors]
