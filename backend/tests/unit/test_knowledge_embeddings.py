"""Phase 4A unit tests: embedding provider abstraction (spec Step 12, items 11-13)."""
import pytest

from app.rag.knowledge.embeddings import (
    DimensionMismatchError,
    EmbeddingError,
    EmbeddingProvider,
    HashingEmbeddingProvider,
)


def test_provider_interface_contract():
    """The pipeline depends only on EmbeddingProvider (Liskov-safe swap)."""
    provider: EmbeddingProvider = HashingEmbeddingProvider(dimension=128)
    assert isinstance(provider, EmbeddingProvider)
    assert provider.dimension == 128
    assert "dim128" in provider.model_name


def test_single_text_embedding_shape():
    provider = HashingEmbeddingProvider(dimension=64)
    vector = provider.embed_text("MITRE ATT&CK technique T1110 Brute Force")
    assert len(vector) == 64
    # L2-normalized output.
    norm = sum(v * v for v in vector) ** 0.5
    assert norm == pytest.approx(1.0, abs=1e-6)


def test_batch_embedding_order_and_count():
    provider = HashingEmbeddingProvider(dimension=32)
    texts = ["first text", "second text", "third text about CVE-2024-1"]
    vectors = provider.embed_texts(texts)
    assert len(vectors) == len(texts)
    assert all(len(v) == 32 for v in vectors)
    # Order preserved: batch[i] matches single[i].
    for text, batch_vector in zip(texts, vectors):
        assert provider.embed_text(text) == batch_vector


def test_embedding_is_deterministic():
    provider = HashingEmbeddingProvider(dimension=256)
    text = "Adversaries may use brute force techniques to gain access."
    assert provider.embed_text(text) == provider.embed_text(text)


def test_different_texts_different_vectors():
    provider = HashingEmbeddingProvider(dimension=256)
    a = provider.embed_text("brute force password attack")
    b = provider.embed_text("phishing email with malicious link")
    assert a != b


def test_empty_batch_returns_empty_list():
    provider = HashingEmbeddingProvider(dimension=256)
    assert provider.embed_texts([]) == []


def test_dimension_must_be_positive():
    with pytest.raises(ValueError):
        HashingEmbeddingProvider(dimension=0)


def test_non_string_input_raises_embedding_error():
    provider = HashingEmbeddingProvider(dimension=64)
    with pytest.raises(EmbeddingError):
        provider.embed_texts(["ok", 123])  # type: ignore[list-item]


def test_dimension_mismatch_error_exists_for_providers():
    """Providers that return wrong-dimension vectors have a dedicated error
    the vector store uses for validation."""
    assert issubclass(DimensionMismatchError, EmbeddingError)
