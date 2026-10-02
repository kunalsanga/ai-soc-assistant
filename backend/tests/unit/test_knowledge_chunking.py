"""Phase 4A unit tests: normalization + deterministic chunking (spec Step 12)."""
import pytest

from app.rag.knowledge.chunking import Chunker, ChunkingConfig
from app.rag.knowledge.normalize import normalize_document, normalize_documents
from app.rag.knowledge.schemas import KnowledgeDocument


def _doc(content: str, **overrides) -> KnowledgeDocument:
    base = dict(
        document_id="mitre_attack:technique:T1110",
        source="mitre_attack",
        document_type="technique",
        title="Brute Force",
        content=content,
        source_url="https://attack.mitre.org/techniques/T1110/",
        source_identifier="T1110",
        metadata={"technique_id": "T1110", "tactics": ["credential-access"]},
    )
    base.update(overrides)
    return KnowledgeDocument(**base)


# ---------------------------------------------------------------------------
# Normalization (spec Step 6)
# ---------------------------------------------------------------------------

def test_normalization_cleans_whitespace():
    doc = _doc("Line one   with\tspaces.\n\n\n\nLine two after blanks.  ")
    normalized = normalize_document(doc)
    assert "Line one with spaces." in normalized.content
    assert "\n\n\n" not in normalized.content


def test_normalization_preserves_security_text():
    text = "Adversaries may use CVE-2024-12345 with T1110.001 against 10.0.0.5."
    normalized = normalize_document(_doc(text))
    assert normalized.content == text


def test_normalization_preserves_source_identity_and_url():
    normalized = normalize_document(_doc("Some content."))
    assert normalized.source == "mitre_attack"
    assert normalized.source_identifier == "T1110"
    assert normalized.source_url == "https://attack.mitre.org/techniques/T1110/"


def test_normalization_rejects_empty_content():
    with pytest.raises(ValueError):
        normalize_document(_doc("   "))


def test_normalization_rejects_empty_title():
    with pytest.raises(ValueError):
        normalize_document(_doc("content", title="  "))


def test_normalization_never_mutates_original():
    doc = _doc("Original   content.")
    original_dump = doc.model_dump()
    normalize_document(doc)
    assert doc.model_dump() == original_dump


def test_normalization_is_deterministic():
    doc = _doc("Some   messy\t\tcontent.\n\n\n\nSecond paragraph.")
    a = normalize_document(doc)
    b = normalize_document(doc)
    assert a.model_dump() == b.model_dump()


def test_normalization_sanitizes_metadata_and_drops_empties():
    normalized = normalize_document(
        _doc("content", metadata={"keep": "value", "empty": "   ", "n": 5})
    )
    assert normalized.metadata == {"keep": "value", "n": 5}


def test_normalize_documents_reports_rejections():
    docs = [_doc("good content"), _doc("   ", document_id="bad-one")]
    kept, errors = normalize_documents(docs)
    assert len(kept) == 1
    assert len(errors) == 1
    assert "bad-one" in errors[0]


# ---------------------------------------------------------------------------
# Chunking (spec Step 7)
# ---------------------------------------------------------------------------

def test_chunking_deterministic_output():
    chunker = Chunker(ChunkingConfig(chunk_size=300, chunk_overlap=50))
    content = " ".join(f"Paragraph {i} with some security text about technique T1110." for i in range(30))
    chunks_a = chunker.chunk_document(_doc(content))
    chunks_b = chunker.chunk_document(_doc(content))
    assert [c.model_dump() for c in chunks_a] == [c.model_dump() for c in chunks_b]


def test_chunking_stable_chunk_ids():
    # Multiple chunks: sized so the content must split.
    chunker = Chunker(ChunkingConfig(chunk_size=200, chunk_overlap=0))
    content = "\n\n".join(f"Paragraph {i} with enough text to matter for sizing." for i in range(6))
    chunks = chunker.chunk_document(_doc(content))
    assert len(chunks) > 1
    assert [c.chunk_id for c in chunks] == [
        f"mitre_attack:technique:T1110::{i}" for i in range(len(chunks))
    ]

    # Deterministic across chunker instances (stable IDs).
    again = Chunker(ChunkingConfig(chunk_size=200, chunk_overlap=0)).chunk_document(_doc(content))
    assert [c.chunk_id for c in again] == [c.chunk_id for c in chunks]


def test_chunking_preserves_document_identity_and_metadata():
    chunker = Chunker()
    chunks = chunker.chunk_document(_doc("Para one.\n\nPara two."))
    for chunk in chunks:
        assert chunk.document_id == "mitre_attack:technique:T1110"
        assert chunk.source == "mitre_attack"
        assert chunk.source_identifier == "T1110"
        assert chunk.source_url == "https://attack.mitre.org/techniques/T1110/"
        # Document metadata is preserved with a doc_ prefix namespace.
        assert chunk.metadata["doc_technique_id"] == "T1110"
        assert chunk.metadata["document_type"] == "technique"


def test_chunking_respects_configured_size():
    chunker = Chunker(ChunkingConfig(chunk_size=200, chunk_overlap=20))
    content = " ".join(f"Wordblock{i} " for i in range(200))
    chunks = chunker.chunk_document(_doc(content))
    assert len(chunks) > 1
    assert all(len(c.content) <= 200 for c in chunks)
    assert [c.chunk_index for c in chunks] == list(range(len(chunks)))


def test_chunking_semantic_paragraph_boundaries():
    """Paragraphs are kept intact when they fit — no mid-sentence cuts."""
    chunker = Chunker(ChunkingConfig(chunk_size=2000, chunk_overlap=0))
    p1 = "Detection: monitor authentication logs for failures."
    p2 = "Platforms: Windows, Linux."
    chunks = chunker.chunk_document(_doc(f"{p1}\n\n{p2}"))
    assert any(p1 in c.content for c in chunks)
    assert any(p2 in c.content for c in chunks)


def test_chunking_config_validation():
    with pytest.raises(ValueError):
        ChunkingConfig(chunk_size=50)  # below minimum
    with pytest.raises(ValueError):
        ChunkingConfig(chunk_size=200, chunk_overlap=200)  # overlap >= size


def test_small_document_single_chunk():
    chunker = Chunker()
    chunks = chunker.chunk_document(_doc("Short technique description."))
    assert len(chunks) == 1
    assert chunks[0].chunk_index == 0
