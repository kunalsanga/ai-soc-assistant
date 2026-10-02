"""Phase 4A unit tests: Qdrant index layer with a fully faked client.

No live Qdrant required: the fake records upserted points so payload
structure, point-ID stability, and dimension validation can be asserted.
"""
import pytest

from app.rag.knowledge.chunking import Chunker
from app.rag.knowledge.embeddings import HashingEmbeddingProvider
from app.rag.knowledge.schemas import KnowledgeChunk, KnowledgeDocument
from app.rag.knowledge.vectorstore.qdrant import QdrantIndex, VectorStoreError


class FakeQdrantClient:
    """Minimal stand-in for qdrant_client.QdrantClient."""

    def __init__(self, existing_collections=()):
        self.existing_collections = list(existing_collections)
        self.collections = {}
        self.upserts = []

    def get_collections(self):
        class _List:
            def __init__(self, names):
                self.collections = [type("C", (), {"name": n})() for n in names]

        return _List(self.existing_collections)

    def create_collection(self, collection_name, vectors_config):
        size = vectors_config.size
        self.collections[collection_name] = {"size": size, "points": {}}

    def get_collection(self, collection_name):
        info = type("Info", (), {})()
        config = type("Config", (), {})()
        params = type("Params", (), {})()
        vectors = type("Vectors", (), {})()
        vectors.size = self.collections[collection_name]["size"]
        params.vectors = vectors
        config.params = params
        info.config = config
        return info

    def upsert(self, collection_name, points, wait=True):
        bucket = self.collections.setdefault(
            collection_name, {"size": None, "points": {}}
        )
        for point in points:
            bucket["points"][point.id] = point
        self.upserts.append((collection_name, len(points)))


def _doc(**overrides) -> KnowledgeDocument:
    base = dict(
        document_id="mitre_attack:technique:T1110",
        source="mitre_attack",
        document_type="technique",
        title="Brute Force",
        content="Adversaries may use brute force.\n\nDetection: monitor logs.",
        source_url="https://attack.mitre.org/techniques/T1110/",
        source_identifier="T1110",
        metadata={"technique_id": "T1110"},
    )
    base.update(overrides)
    return KnowledgeDocument(**base)


def _index_with_fake(provider=None, existing=()) -> tuple[QdrantIndex, FakeQdrantClient]:
    fake = FakeQdrantClient(existing_collections=existing)
    index = QdrantIndex(
        url="http://qdrant:6333",
        collection="security_knowledge",
        embedding_provider=provider or HashingEmbeddingProvider(dimension=64),
    )
    index._client = fake  # inject before first use; lazy init bypassed
    return index, fake


def test_point_ids_are_stable_across_instances():
    id_a = QdrantIndex.point_id_for("mitre_attack:technique:T1110::0")
    id_b = QdrantIndex.point_id_for("mitre_attack:technique:T1110::0")
    assert id_a == id_b
    # Different chunk → different point.
    assert id_a != QdrantIndex.point_id_for("mitre_attack:technique:T1110::1")


def test_payload_contains_full_provenance():
    index, _ = _index_with_fake()
    chunk = Chunker().chunk_document(_doc())[0]
    payload = index.build_payload(chunk, model_name="test-model/v1")

    # Provenance questions (spec Step 13) answerable from payload alone:
    assert payload["source"] == "mitre_attack"                    # which source?
    assert payload["document_id"] == "mitre_attack:technique:T1110"  # which document?
    assert payload["source_identifier"] == "T1110"                # which source id?
    assert payload["source_url"] == "https://attack.mitre.org/techniques/T1110/"  # url?
    assert payload["chunk_id"].endswith("::0")                    # which chunk?
    assert payload["title"] == "Brute Force"
    assert payload["model_name"] == "test-model/v1"
    assert payload["content"] == chunk.content


def test_upsert_creates_collection_and_stores_points():
    index, fake = _index_with_fake()
    chunks = Chunker().chunk_document(_doc())
    count = index.upsert_chunks(chunks)

    assert count == len(chunks)
    assert "security_knowledge" in fake.collections
    stored = fake.collections["security_knowledge"]["points"]
    assert len(stored) == len(chunks)
    # Points carry the vector at the provider dimension.
    point = next(iter(stored.values()))
    assert len(point.vector) == 64


def test_upsert_is_idempotent_on_reindex():
    """Re-indexing the same chunks overwrites the same points (no duplicates)."""
    index, fake = _index_with_fake()
    chunks = Chunker().chunk_document(_doc())

    index.upsert_chunks(chunks)
    first_ids = set(fake.collections["security_knowledge"]["points"].keys())
    index.upsert_chunks(chunks)
    second_ids = set(fake.collections["security_knowledge"]["points"].keys())

    assert first_ids == second_ids
    assert len(fake.collections["security_knowledge"]["points"]) == len(chunks)


def test_upsert_validates_vector_dimension():
    index, _ = _index_with_fake(provider=HashingEmbeddingProvider(dimension=64))
    # Simulate a misbehaving provider after construction.
    class LyingProvider(HashingEmbeddingProvider):
        @property
        def dimension(self):
            return 64

        def embed_texts(self, texts):
            return [[0.0] * 32 for _ in texts]  # wrong size

    index._provider = LyingProvider(32)
    with pytest.raises(VectorStoreError) as excinfo:
        index.upsert_chunks(Chunker().chunk_document(_doc()))
    assert "dimension" in str(excinfo.value)


def test_existing_collection_dimension_mismatch_rejected():
    provider = HashingEmbeddingProvider(dimension=64)
    fake = FakeQdrantClient(existing_collections=["security_knowledge"])
    fake.collections["security_knowledge"] = {"size": 1536, "points": {}}
    index = QdrantIndex(
        url="http://qdrant:6333",
        collection="security_knowledge",
        embedding_provider=provider,
    )
    index._client = fake
    with pytest.raises(VectorStoreError) as excinfo:
        index.upsert_chunks(Chunker().chunk_document(_doc()))
    assert "1536" in str(excinfo.value)


def test_empty_chunk_list_is_noop():
    index, fake = _index_with_fake()
    assert index.upsert_chunks([]) == 0
    assert not fake.upserts


def test_missing_url_rejected_at_construction():
    with pytest.raises(VectorStoreError):
        QdrantIndex(url="", collection="c", embedding_provider=HashingEmbeddingProvider())
    with pytest.raises(VectorStoreError):
        QdrantIndex(url="http://q", collection="", embedding_provider=HashingEmbeddingProvider())
