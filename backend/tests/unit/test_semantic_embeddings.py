"""Unit tests for the semantic embedding provider and provider factory.

Hermetic: the SentenceTransformer model is mocked, so no download or model
load ever happens in unit tests. The real model is exercised by the
retrieval verification script / E2E run instead.
"""
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from app.rag.knowledge.embeddings import (
    EmbeddingError,
    EmbeddingProvider,
    HashingEmbeddingProvider,
    SemanticEmbeddingProvider,
    build_embedding_provider,
)


def _fake_sentence_transformer(dimension: int = 384) -> MagicMock:
    model = MagicMock(spec=[
        "get_embedding_dimension",
        "get_sentence_embedding_dimension",
        "encode",
    ])
    model.get_embedding_dimension.return_value = dimension

    def encode(texts, **kwargs):
        rows = []
        for i, _ in enumerate(texts):
            vec = np.zeros(dimension, dtype=np.float32)
            vec[i % dimension] = 1.0
            rows.append(vec)
        vectors = np.vstack(rows)
        if kwargs.get("normalize_embeddings"):
            norms = np.linalg.norm(vectors, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            vectors = vectors / norms
        return vectors

    model.encode.side_effect = encode
    return model


class TestSemanticEmbeddingProvider:
    def test_liskov_swap_with_interface(self):
        provider = SemanticEmbeddingProvider()
        assert isinstance(provider, EmbeddingProvider)

    def test_lazy_load_on_dimension_access(self):
        provider = SemanticEmbeddingProvider()
        with patch(
            "sentence_transformers.SentenceTransformer",
            return_value=_fake_sentence_transformer(384),
        ) as ctor:
            assert provider.dimension == 384
            ctor.assert_called_once()
            # Second access must not reload the model.
            _ = provider.dimension
            ctor.assert_called_once()

    def test_model_name_records_provenance(self):
        provider = SemanticEmbeddingProvider(model_id="sentence-transformers/all-MiniLM-L6-v2")
        assert provider.model_name == "sentence-transformers/all-MiniLM-L6-v2"

    def test_model_name_accepts_bare_model_id(self):
        provider = SemanticEmbeddingProvider(model_id="all-MiniLM-L6-v2")
        assert provider.model_name == "sentence-transformers/all-MiniLM-L6-v2"

    def test_embed_texts_batch_shape_and_order(self):
        provider = SemanticEmbeddingProvider()
        fake = _fake_sentence_transformer(384)
        with patch("sentence_transformers.SentenceTransformer", return_value=fake):
            vectors = provider.embed_texts(["brute force", "password spraying", "xss"])
            assert len(vectors) == 3
            assert all(len(v) == 384 for v in vectors)
            # Deterministic identity vectors in input order (per fake encoder).
            assert vectors[0][0] == pytest.approx(1.0)
            assert vectors[1][1] == pytest.approx(1.0)
            assert vectors[2][2] == pytest.approx(1.0)

    def test_embed_texts_empty_input(self):
        provider = SemanticEmbeddingProvider()
        with patch("sentence_transformers.SentenceTransformer") as ctor:
            assert provider.embed_texts([]) == []
            ctor.assert_not_called()

    def test_embed_texts_rejects_non_string(self):
        provider = SemanticEmbeddingProvider()
        with pytest.raises(EmbeddingError):
            provider.embed_texts(["ok", 123])

    def test_encode_failure_wrapped_in_embedding_error(self):
        provider = SemanticEmbeddingProvider()
        fake = _fake_sentence_transformer(384)
        fake.encode.side_effect = RuntimeError("CUDA OOM")
        with patch("sentence_transformers.SentenceTransformer", return_value=fake):
            with pytest.raises(EmbeddingError, match="Semantic embedding failed"):
                provider.embed_texts(["text"])

    def test_load_failure_wrapped_in_embedding_error(self):
        provider = SemanticEmbeddingProvider()
        with patch(
            "sentence_transformers.SentenceTransformer",
            side_effect=OSError("model download failed"),
        ):
            with pytest.raises(EmbeddingError, match="Failed to load"):
                provider.embed_texts(["text"])

    def test_dimension_mismatch_detected(self):
        provider = SemanticEmbeddingProvider()
        fake = _fake_sentence_transformer(384)
        # Model lies about its dimension: encoder returns 256-wide vectors.
        fake.get_embedding_dimension.return_value = 256

        def encode(texts, **kwargs):
            return np.ones((len(texts), 384), dtype=np.float32)

        fake.encode.side_effect = encode
        with patch("sentence_transformers.SentenceTransformer", return_value=fake):
            with pytest.raises(EmbeddingError, match="shape"):
                provider.embed_texts(["text"])


class TestProviderFactory:
    def test_default_is_hashing(self, monkeypatch):
        monkeypatch.setattr("app.core.config.settings.EMBEDDING_PROVIDER", "local-hashing")
        provider = build_embedding_provider()
        assert isinstance(provider, HashingEmbeddingProvider)
        assert not isinstance(provider, SemanticEmbeddingProvider)

    def test_semantic_selection(self, monkeypatch):
        monkeypatch.setattr("app.core.config.settings.EMBEDDING_PROVIDER", "semantic")
        monkeypatch.setattr(
            "app.core.config.settings.SEMANTIC_EMBEDDING_MODEL",
            "sentence-transformers/all-MiniLM-L6-v2",
        )
        provider = build_embedding_provider()
        assert isinstance(provider, SemanticEmbeddingProvider)
        # Constructing must NOT load the model (lazy).
        assert provider._model is None

    def test_unknown_provider_raises(self, monkeypatch):
        monkeypatch.setattr("app.core.config.settings.EMBEDDING_PROVIDER", "gpt4")
        with pytest.raises(EmbeddingError, match="Unknown EMBEDDING_PROVIDER"):
            build_embedding_provider()
