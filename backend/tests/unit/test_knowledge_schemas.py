"""Phase 4A unit tests: knowledge schemas, normalization, sources (spec Step 12)."""
import pytest
from pydantic import ValidationError

from app.rag.knowledge.schemas import KnowledgeChunk, KnowledgeDocument


def test_knowledge_document_validation_ok():
    doc = KnowledgeDocument(
        document_id="mitre_attack:technique:T1110",
        source="mitre_attack",
        document_type="technique",
        title="Brute Force",
        content="Adversaries may use brute force techniques...",
        source_url="https://attack.mitre.org/techniques/T1110/",
        source_identifier="T1110",
        metadata={"technique_id": "T1110"},
    )
    assert doc.document_id == "mitre_attack:technique:T1110"
    assert doc.metadata["technique_id"] == "T1110"
    assert doc.version is None


def test_knowledge_document_requires_core_fields():
    with pytest.raises(ValidationError):
        KnowledgeDocument(
            document_id="",  # empty id rejected
            source="mitre_attack",
            document_type="technique",
            title="x",
            content="y",
        )


def test_knowledge_document_is_frozen():
    doc = KnowledgeDocument(
        document_id="d1", source="s", document_type="t", title="T", content="C"
    )
    with pytest.raises(ValidationError):
        doc.title = "changed"


def test_knowledge_chunk_validation_ok():
    chunk = KnowledgeChunk(
        chunk_id="d1::0",
        document_id="d1",
        source="nvd_cve",
        source_identifier="CVE-2024-1",
        source_url="https://nvd.nist.gov/vuln/detail/CVE-2024-1",
        title="CVE-2024-1",
        chunk_index=0,
        content="text",
        metadata={"document_type": "cve_record"},
    )
    assert chunk.chunk_index == 0
    assert chunk.metadata["document_type"] == "cve_record"


def test_knowledge_chunk_rejects_negative_index():
    with pytest.raises(ValidationError):
        KnowledgeChunk(
            chunk_id="d1::bad",
            document_id="d1",
            source="s",
            title="T",
            chunk_index=-1,
            content="c",
        )


def test_chunk_metadata_defaults_empty_not_none():
    chunk = KnowledgeChunk(
        chunk_id="d1::0", document_id="d1", source="s", title="T",
        chunk_index=0, content="c",
    )
    assert chunk.metadata == {}
    assert chunk.source_identifier is None
