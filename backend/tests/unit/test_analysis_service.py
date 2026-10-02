"""Unit tests for AnalysisService.

The database session is mocked with AsyncMock + MagicMock; no PostgreSQL is
required. The tests verify the service's contract:
  - Correct DB queries are issued.
  - Correct ORM objects are added/committed.
  - Domain exceptions are raised on missing Alert / Analysis.
  - Evidence is correctly built and persisted.

Pattern mirrors test_alert_service.py: we mock db.execute to return controlled
result objects, then assert on db.add / db.commit / db.flush call counts and
arguments.
"""
from __future__ import annotations

from typing import List, Optional
from unittest.mock import AsyncMock, MagicMock, call, patch

import pytest

from app.db.models.alert import Alert, Analysis, Evidence
from app.schemas.alert import AnalysisCreate, EvidenceCreate
from app.services.analysis import AnalysisService
from app.services.exceptions import (
    AlertNotFoundError,
    AnalysisNotFoundError,
    InvalidAnalysisStateError,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_alert(alert_id: int = 1) -> Alert:
    """Return a minimal Alert ORM object (no DB required)."""
    a = Alert()
    a.id = alert_id
    a.external_alert_id = f"ext-{alert_id}"
    a.status = "open"
    return a


def _make_analysis(analysis_id: int = 10, alert_id: int = 1) -> Analysis:
    """Return a minimal Analysis ORM object (no DB required)."""
    from datetime import datetime, timezone

    an = Analysis()
    an.id = analysis_id
    an.alert_id = alert_id
    an.summary = "Test summary"
    an.created_at = datetime(2026, 10, 1, tzinfo=timezone.utc)
    an.evidence = []
    return an


def _make_evidence(evidence_id: int = 100, analysis_id: int = 10) -> Evidence:
    """Return a minimal Evidence ORM object (no DB required)."""
    e = Evidence()
    e.id = evidence_id
    e.analysis_id = analysis_id
    e.source = "MITRE"
    e.document_id = "T1110"
    e.title = "Brute Force"
    e.content = "Adversary may use brute force..."
    e.relevance_score = 0.95
    e.citation = "https://attack.mitre.org/techniques/T1110/"
    return e


def _db_returning(row) -> AsyncMock:
    """Build an AsyncMock db whose execute() returns a result yielding `row`."""
    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = row
    db.execute = AsyncMock(return_value=result)
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.add = MagicMock()
    return db


def _db_returning_sequence(rows: list) -> AsyncMock:
    """Build an AsyncMock db whose execute() returns each row in sequence."""
    db = AsyncMock()
    results = []
    for row in rows:
        r = MagicMock()
        r.scalar_one_or_none.return_value = row
        results.append(r)
    db.execute = AsyncMock(side_effect=results)
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.add = MagicMock()
    return db


def _analysis_create(
    summary: str = "AI summary",
    evidence_items: Optional[List[EvidenceCreate]] = None,
) -> AnalysisCreate:
    """Build a minimal AnalysisCreate payload."""
    return AnalysisCreate(
        summary=summary,
        severity_assessment="High",
        explanation="Explanation text",
        recommended_investigation="Investigate source IP",
        confidence="0.87",
        model_name="stub-model",
        analysis_type="rag",
        evidence=evidence_items or [],
    )


def _evidence_create(
    source: str = "MITRE",
    doc_id: str = "T1110",
    score: float = 0.9,
) -> EvidenceCreate:
    """Build a minimal EvidenceCreate payload."""
    return EvidenceCreate(
        source=source,
        document_id=doc_id,
        title="Brute Force",
        content="Adversary may use brute force...",
        relevance_score=score,
        citation=f"https://attack.mitre.org/techniques/{doc_id}/",
    )


# ---------------------------------------------------------------------------
# create_analysis
# ---------------------------------------------------------------------------

class TestCreateAnalysis:

    @pytest.mark.asyncio
    async def test_create_analysis_inserts_row_when_alert_exists(self):
        """Happy path: valid alert_id → Analysis row is added and committed."""
        alert = _make_alert(alert_id=1)
        db = _db_returning(alert)

        service = AnalysisService()
        await service.create_analysis(db, alert_id=1, data=_analysis_create())

        db.add.assert_called_once()
        added: Analysis = db.add.call_args[0][0]
        assert isinstance(added, Analysis)
        assert added.alert_id == 1
        assert added.summary == "AI summary"
        assert added.model_name == "stub-model"

        db.flush.assert_awaited_once()
        db.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_create_analysis_raises_when_alert_missing(self):
        """Alert not found → AlertNotFoundError, nothing is committed."""
        db = _db_returning(None)  # simulate alert not found

        service = AnalysisService()
        with pytest.raises(AlertNotFoundError) as exc_info:
            await service.create_analysis(db, alert_id=999, data=_analysis_create())

        assert "999" in str(exc_info.value)
        db.add.assert_not_called()
        db.commit.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_create_analysis_with_optional_fields_none(self):
        """All optional content fields may be None (pending state)."""
        alert = _make_alert(alert_id=2)
        db = _db_returning(alert)

        data = AnalysisCreate()  # all fields default to None
        service = AnalysisService()
        await service.create_analysis(db, alert_id=2, data=data)

        added: Analysis = db.add.call_args[0][0]
        assert added.summary is None
        assert added.model_name is None
        assert added.alert_id == 2

    @pytest.mark.asyncio
    async def test_create_analysis_with_inline_evidence(self):
        """Evidence provided in the create payload is persisted in same txn."""
        alert = _make_alert(alert_id=3)
        db = _db_returning(alert)

        ev1 = _evidence_create(doc_id="T1110", score=0.9)
        ev2 = _evidence_create(source="NVD", doc_id="CVE-2024-1234", score=0.7)
        data = _analysis_create(evidence_items=[ev1, ev2])

        service = AnalysisService()
        await service.create_analysis(db, alert_id=3, data=data)

        # 1 Analysis + 2 Evidence rows added.
        assert db.add.call_count == 3
        added_types = [type(db.add.call_args_list[i][0][0]) for i in range(3)]
        assert added_types[0] == Analysis
        assert added_types[1] == Evidence
        assert added_types[2] == Evidence

    @pytest.mark.asyncio
    async def test_create_analysis_no_inline_evidence(self):
        """No evidence → only 1 add() call (the Analysis itself)."""
        alert = _make_alert(alert_id=4)
        db = _db_returning(alert)

        service = AnalysisService()
        await service.create_analysis(db, alert_id=4, data=_analysis_create(evidence_items=[]))

        db.add.assert_called_once()


# ---------------------------------------------------------------------------
# get_analysis_by_id
# ---------------------------------------------------------------------------

class TestGetAnalysisById:

    @pytest.mark.asyncio
    async def test_returns_existing_analysis(self):
        """Happy path: found → return the Analysis object."""
        analysis = _make_analysis(analysis_id=10, alert_id=1)
        db = _db_returning(analysis)

        service = AnalysisService()
        result = await service.get_analysis_by_id(db, analysis_id=10)

        assert result is analysis
        assert result.id == 10

    @pytest.mark.asyncio
    async def test_raises_when_analysis_not_found(self):
        """Missing analysis → AnalysisNotFoundError."""
        db = _db_returning(None)

        service = AnalysisService()
        with pytest.raises(AnalysisNotFoundError) as exc_info:
            await service.get_analysis_by_id(db, analysis_id=404)

        assert "404" in str(exc_info.value)


# ---------------------------------------------------------------------------
# get_analyses_for_alert
# ---------------------------------------------------------------------------

class TestGetAnalysesForAlert:

    @pytest.mark.asyncio
    async def test_returns_empty_list_when_no_analyses(self):
        """Alert exists but has no analyses → empty list, no error."""
        alert = _make_alert(alert_id=5)

        db = AsyncMock()
        db.flush = AsyncMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()
        db.add = MagicMock()

        # First execute → alert found; second execute → empty scalars result.
        alert_result = MagicMock()
        alert_result.scalar_one_or_none.return_value = alert

        analyses_result = MagicMock()
        analyses_result.scalars.return_value.all.return_value = []

        db.execute = AsyncMock(side_effect=[alert_result, analyses_result])

        service = AnalysisService()
        result = await service.get_analyses_for_alert(db, alert_id=5)

        assert result == []

    @pytest.mark.asyncio
    async def test_raises_when_alert_missing(self):
        """Alert not found → AlertNotFoundError (not a silent empty list)."""
        db = _db_returning(None)

        service = AnalysisService()
        with pytest.raises(AlertNotFoundError) as exc_info:
            await service.get_analyses_for_alert(db, alert_id=999)

        assert "999" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_returns_multiple_analyses(self):
        """Alert with two analyses → both returned."""
        alert = _make_alert(alert_id=6)
        an1 = _make_analysis(analysis_id=11, alert_id=6)
        an2 = _make_analysis(analysis_id=12, alert_id=6)

        db = AsyncMock()
        db.flush = AsyncMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()
        db.add = MagicMock()

        alert_result = MagicMock()
        alert_result.scalar_one_or_none.return_value = alert

        analyses_result = MagicMock()
        analyses_result.scalars.return_value.all.return_value = [an1, an2]

        db.execute = AsyncMock(side_effect=[alert_result, analyses_result])

        service = AnalysisService()
        result = await service.get_analyses_for_alert(db, alert_id=6)

        assert len(result) == 2
        assert result[0].id == 11
        assert result[1].id == 12


# ---------------------------------------------------------------------------
# get_latest_analysis_for_alert
# ---------------------------------------------------------------------------

class TestGetLatestAnalysisForAlert:

    @pytest.mark.asyncio
    async def test_returns_none_when_no_analyses(self):
        """No analyses → returns None without raising."""
        alert = _make_alert(alert_id=7)

        db = AsyncMock()
        db.flush = AsyncMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()
        db.add = MagicMock()

        alert_result = MagicMock()
        alert_result.scalar_one_or_none.return_value = alert
        analyses_result = MagicMock()
        analyses_result.scalars.return_value.all.return_value = []
        db.execute = AsyncMock(side_effect=[alert_result, analyses_result])

        service = AnalysisService()
        result = await service.get_latest_analysis_for_alert(db, alert_id=7)

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_first_analysis_from_ordered_list(self):
        """Returns the first element (most recent) from ordered results."""
        alert = _make_alert(alert_id=8)
        an = _make_analysis(analysis_id=20, alert_id=8)

        db = AsyncMock()
        db.flush = AsyncMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()
        db.add = MagicMock()

        alert_result = MagicMock()
        alert_result.scalar_one_or_none.return_value = alert
        analyses_result = MagicMock()
        analyses_result.scalars.return_value.all.return_value = [an]
        db.execute = AsyncMock(side_effect=[alert_result, analyses_result])

        service = AnalysisService()
        result = await service.get_latest_analysis_for_alert(db, alert_id=8)

        assert result is an


# ---------------------------------------------------------------------------
# add_evidence
# ---------------------------------------------------------------------------

class TestAddEvidence:

    @pytest.mark.asyncio
    async def test_add_evidence_to_existing_analysis(self):
        """Happy path: evidence items are added and committed."""
        analysis = _make_analysis(analysis_id=30)
        db = _db_returning(analysis)

        items = [_evidence_create(doc_id="T1110"), _evidence_create(doc_id="T1190")]
        service = AnalysisService()
        rows = await service.add_evidence(db, analysis_id=30, evidence_items=items)

        assert db.add.call_count == 2
        assert db.commit.await_count == 1

        for row in db.add.call_args_list:
            added = row[0][0]
            assert isinstance(added, Evidence)
            assert added.analysis_id == 30

    @pytest.mark.asyncio
    async def test_add_evidence_raises_when_analysis_missing(self):
        """Analysis not found → AnalysisNotFoundError, no commit."""
        db = _db_returning(None)

        service = AnalysisService()
        with pytest.raises(AnalysisNotFoundError) as exc_info:
            await service.add_evidence(
                db, analysis_id=999, evidence_items=[_evidence_create()]
            )

        assert "999" in str(exc_info.value)
        db.add.assert_not_called()
        db.commit.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_add_evidence_raises_on_empty_list(self):
        """Passing an empty list is a programming error → InvalidAnalysisStateError."""
        db = _db_returning(None)  # db not needed — exception fires before query

        service = AnalysisService()
        with pytest.raises(InvalidAnalysisStateError) as exc_info:
            await service.add_evidence(db, analysis_id=1, evidence_items=[])

        assert "empty" in str(exc_info.value).lower()
        # No DB queries should have been made.
        db.execute.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_evidence_fields_are_mapped_correctly(self):
        """Each EvidenceCreate field maps exactly to the Evidence ORM column."""
        analysis = _make_analysis(analysis_id=40)
        db = _db_returning(analysis)

        ev = EvidenceCreate(
            source="NVD",
            document_id="CVE-2024-9999",
            title="Critical RCE",
            content="Remote code execution in component X",
            relevance_score=0.98,
            citation="https://nvd.nist.gov/vuln/detail/CVE-2024-9999",
        )
        service = AnalysisService()
        await service.add_evidence(db, analysis_id=40, evidence_items=[ev])

        added: Evidence = db.add.call_args[0][0]
        assert added.source == "NVD"
        assert added.document_id == "CVE-2024-9999"
        assert added.title == "Critical RCE"
        assert added.content == "Remote code execution in component X"
        assert added.relevance_score == 0.98
        assert added.citation == "https://nvd.nist.gov/vuln/detail/CVE-2024-9999"
        assert added.analysis_id == 40


# ---------------------------------------------------------------------------
# get_evidence_for_analysis
# ---------------------------------------------------------------------------

class TestGetEvidenceForAnalysis:

    @pytest.mark.asyncio
    async def test_raises_when_analysis_missing(self):
        """Analysis not found → AnalysisNotFoundError."""
        db = _db_returning(None)

        service = AnalysisService()
        with pytest.raises(AnalysisNotFoundError):
            await service.get_evidence_for_analysis(db, analysis_id=999)

    @pytest.mark.asyncio
    async def test_returns_evidence_list(self):
        """Happy path: analysis exists → evidence list returned."""
        analysis = _make_analysis(analysis_id=50)
        ev1 = _make_evidence(evidence_id=201, analysis_id=50)
        ev2 = _make_evidence(evidence_id=202, analysis_id=50)

        db = AsyncMock()
        db.flush = AsyncMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()
        db.add = MagicMock()

        analysis_result = MagicMock()
        analysis_result.scalar_one_or_none.return_value = analysis
        evidence_result = MagicMock()
        evidence_result.scalars.return_value.all.return_value = [ev1, ev2]

        db.execute = AsyncMock(side_effect=[analysis_result, evidence_result])

        service = AnalysisService()
        result = await service.get_evidence_for_analysis(db, analysis_id=50)

        assert len(result) == 2
        assert result[0].id == 201
        assert result[1].id == 202

    @pytest.mark.asyncio
    async def test_returns_empty_list_when_no_evidence(self):
        """Analysis exists but has no evidence → empty list, no error."""
        analysis = _make_analysis(analysis_id=51)

        db = AsyncMock()
        db.flush = AsyncMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()
        db.add = MagicMock()

        analysis_result = MagicMock()
        analysis_result.scalar_one_or_none.return_value = analysis
        evidence_result = MagicMock()
        evidence_result.scalars.return_value.all.return_value = []

        db.execute = AsyncMock(side_effect=[analysis_result, evidence_result])

        service = AnalysisService()
        result = await service.get_evidence_for_analysis(db, analysis_id=51)

        assert result == []


# ---------------------------------------------------------------------------
# _build_evidence_rows (internal helper — tested directly)
# ---------------------------------------------------------------------------

class TestBuildEvidenceRows:

    def test_builds_correct_count(self):
        items = [_evidence_create(), _evidence_create(source="NVD")]
        rows = AnalysisService._build_evidence_rows(analysis_id=99, items=items)
        assert len(rows) == 2

    def test_all_rows_have_correct_analysis_id(self):
        items = [_evidence_create(), _evidence_create()]
        rows = AnalysisService._build_evidence_rows(analysis_id=77, items=items)
        for row in rows:
            assert row.analysis_id == 77

    def test_field_mapping_is_complete(self):
        item = _evidence_create(source="MITRE", doc_id="T1059", score=0.88)
        rows = AnalysisService._build_evidence_rows(analysis_id=1, items=[item])
        row = rows[0]
        assert row.source == "MITRE"
        assert row.document_id == "T1059"
        assert row.relevance_score == 0.88
