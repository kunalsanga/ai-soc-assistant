"""Phase 4A unit tests: KnowledgeIngestionPipeline composition (spec Step 12, 16-18).

Uses real local stages (normalize/chunk) with a fake vector index so the
full load → normalize → chunk → embed → index flow runs without services.
"""
import json

import pytest

from app.rag.knowledge.chunking import Chunker
from app.rag.knowledge.embeddings import HashingEmbeddingProvider
from app.rag.knowledge.pipeline import KnowledgeIngestionPipeline
from app.rag.knowledge.sources.base import KnowledgeSource, KnowledgeSourceError
from app.rag.knowledge.sources.mitre import MitreAttackSource
from app.rag.knowledge.vectorstore.qdrant import VectorStoreError


class StaticSource(KnowledgeSource):
    """Test source serving fixed raw records."""

    def __init__(self, records, name="static", fail=False):
        self._records = records
        self._name = name
        self._fail = fail

    @property
    def name(self) -> str:
        return self._name

    def load_raw(self):
        if self._fail:
            raise KnowledgeSourceError("simulated source outage")
        return self._records

    def normalize_record(self, record):
        from app.rag.knowledge.schemas import KnowledgeDocument

        doc_id = record.get("document_id")
        if not doc_id:
            raise ValueError("missing document_id")
        return KnowledgeDocument(
            document_id=doc_id,
            source=self._name,
            document_type=record.get("document_type", "doc"),
            title=record.get("title", "Untitled"),
            content=record.get("content", "default content"),
            source_identifier=record.get("source_identifier"),
            metadata=record.get("metadata", {}),
        )


class FakeIndex:
    """Records upserts without any external service."""

    def __init__(self, fail=False):
        self.calls = []
        self._fail = fail

    def upsert_chunks(self, chunks):
        if self._fail:
            raise VectorStoreError("simulated qdrant outage")
        self.calls.append(list(chunks))
        return len(chunks)


def _record(doc_id, content="Some knowledge content for testing."):
    return {
        "document_id": doc_id,
        "title": f"Title of {doc_id}",
        "content": content,
        "source_identifier": doc_id.split(":")[-1],
    }


def test_pipeline_full_composition(tmp_path):
    """Source → normalize → chunk → embed → index over a real STIX file."""
    bundle = {"type": "bundle", "objects": [
        {"type": "attack-pattern", "id": "attack-pattern--1", "name": "Brute Force",
         "description": "Adversaries may use brute force techniques.",
         "external_references": [{"source_name": "mitre-attack", "external_id": "T1110",
                                  "url": "https://attack.mitre.org/techniques/T1110/"}]},
    ]}
    path = tmp_path / "enterprise-attack.json"
    path.write_text(json.dumps(bundle), encoding="utf-8")

    fake_index = FakeIndex()
    pipeline = KnowledgeIngestionPipeline(
        chunker=Chunker(),
        embedding_provider=HashingEmbeddingProvider(dimension=64),
        index=fake_index,  # type: ignore[arg-type]
    )
    result = pipeline.run([MitreAttackSource(path)])

    assert result.ok
    assert result.documents_per_source == {"mitre_attack": 1}
    assert result.chunks_per_source == {"mitre_attack": 1}
    assert result.indexed_chunks == 1
    assert fake_index.calls[0][0].chunk_id == "mitre_attack:technique:T1110::0"
    # Provenance survives the whole chain.
    chunk = fake_index.calls[0][0]
    assert chunk.source_identifier == "T1110"
    assert chunk.source_url == "https://attack.mitre.org/techniques/T1110/"


def test_pipeline_batch_processing_multiple_sources():
    fake_index = FakeIndex()
    pipeline = KnowledgeIngestionPipeline(
        chunker=Chunker(),
        embedding_provider=HashingEmbeddingProvider(dimension=64),
        index=fake_index,  # type: ignore[arg-type]
    )
    result = pipeline.run([
        StaticSource([_record("s1:doc:a"), _record("s1:doc:b")], name="s1"),
        StaticSource([_record("s2:doc:c")], name="s2"),
    ])

    assert result.ok
    assert result.documents_per_source == {"s1": 2, "s2": 1}
    assert result.indexed_chunks == 3
    assert sum(len(c) for c in fake_index.calls) == 3


def test_pipeline_empty_source_handled():
    fake_index = FakeIndex()
    pipeline = KnowledgeIngestionPipeline(index=fake_index)  # type: ignore[arg-type]
    result = pipeline.run([StaticSource([], name="empty")])

    assert result.indexed_chunks == 0
    assert not fake_index.calls
    assert result.ok  # empty input is valid, not an error


def test_pipeline_no_sources_at_all():
    pipeline = KnowledgeIngestionPipeline(index=FakeIndex())  # type: ignore[arg-type]
    result = pipeline.run([])
    assert result.indexed_chunks == 0
    assert result.ok


def test_pipeline_duplicate_document_last_wins():
    """Same document_id twice → single document, later record replaces."""
    fake_index = FakeIndex()
    pipeline = KnowledgeIngestionPipeline(index=fake_index)  # type: ignore[arg-type]
    result = pipeline.run([
        StaticSource(
            [_record("s1:doc:a", "first version"), _record("s1:doc:a", "second version")],
            name="s1",
        )
    ])

    assert result.documents_per_source == {"s1": 2}  # before dedupe
    assert result.indexed_chunks == 1
    assert fake_index.calls[0][0].content == "second version"


def test_pipeline_reports_source_failure_without_crashing():
    fake_index = FakeIndex()
    pipeline = KnowledgeIngestionPipeline(index=fake_index)  # type: ignore[arg-type]
    result = pipeline.run([
        StaticSource([], name="broken", fail=True),
        StaticSource([_record("s2:doc:c")], name="healthy"),
    ])

    assert not result.ok
    assert any("broken" in e for e in result.source_errors)
    assert result.indexed_chunks == 1  # healthy source still processed


def test_pipeline_reports_invalid_records():
    pipeline = KnowledgeIngestionPipeline(index=FakeIndex())  # type: ignore[arg-type]
    result = pipeline.run([
        StaticSource([{"title": "no id"}, _record("s1:doc:ok")], name="s1"),
    ])
    assert result.ok  # record-level issues don't fail the run
    assert len(result.rejected_records) == 1
    assert "document_id" in result.rejected_records[0]
    assert result.indexed_chunks == 1


def test_pipeline_reports_index_failure():
    pipeline = KnowledgeIngestionPipeline(index=FakeIndex(fail=True))  # type: ignore[arg-type]
    result = pipeline.run([StaticSource([_record("s1:doc:a")], name="s1")])

    assert not result.ok
    assert any("qdrant" in e for e in result.source_errors)


def test_pipeline_lazy_dependencies_need_no_services():
    """Pipeline construction requires no Qdrant and no embedding model."""
    pipeline = KnowledgeIngestionPipeline()
    assert pipeline is not None
