"""Route-level tests for the analysis endpoints.

Tests:
  POST /api/v1/alerts/{id}/analyze
  GET  /api/v1/alerts/{id}/analysis

Strategy:
  - Uses AsyncClient + ASGITransport to send real HTTP requests through the
    FastAPI app, exercising the full request/response cycle including
    serialisation and status codes.
  - The database session (get_db dependency) is overridden per-test with an
    AsyncMock so no real PostgreSQL is required.
  - AnalysisService methods are patched where needed to isolate route logic
    from service logic (which is already covered in test_analysis_service.py).

This file does NOT re-test the service layer. It tests:
  1. Correct HTTP status codes for success and error cases.
  2. Correct response shape (AnalysisSchema fields present).
  3. Correct exception-to-HTTP mapping (AlertNotFoundError → 404, etc.).
  4. That the route calls the service with the right arguments.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.db.database import get_db
from app.db.models.alert import Alert, Analysis
from app.main import app
from app.services.exceptions import AlertNotFoundError, AnalysisNotFoundError


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_analysis(
    analysis_id: int = 1,
    alert_id: int = 10,
    analysis_type: str = "stub",
) -> Analysis:
    """Return a minimal in-memory Analysis ORM object."""
    an = Analysis()
    an.id = analysis_id
    an.alert_id = alert_id
    an.summary = "AI analysis pipeline not yet connected."
    an.severity_assessment = "pending"
    an.explanation = "Stub explanation."
    an.recommended_investigation = "Manual review."
    an.confidence = "0.0"
    an.model_name = "stub"
    an.analysis_type = analysis_type
    an.created_at = datetime(2026, 10, 2, 14, 0, 0, tzinfo=timezone.utc)
    an.evidence = []
    return an


def _mock_db_session() -> AsyncMock:
    """Return a fully-mocked async DB session."""
    db = AsyncMock()
    db.execute = AsyncMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.add = MagicMock()
    return db


async def _db_override(mock_db: AsyncMock):
    """FastAPI dependency override that yields the mock session."""
    yield mock_db


# ---------------------------------------------------------------------------
# POST /api/v1/alerts/{id}/analyze
# ---------------------------------------------------------------------------

class TestAnalyzeAlertEndpoint:

    @pytest.mark.asyncio
    async def test_returns_201_or_200_with_analysis_schema(self):
        """Happy path: alert exists → Analysis created → AnalysisSchema returned."""
        analysis = _make_analysis(analysis_id=1, alert_id=10)
        mock_db = _mock_db_session()

        # Override get_db for this test.
        app.dependency_overrides[get_db] = lambda: _db_override(mock_db)

        with patch(
            "app.services.orchestrator.SOCAnalysisOrchestrator.analyze_alert",
            new_callable=AsyncMock,
            return_value=analysis,
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as ac:
                response = await ac.post("/api/v1/alerts/10/analyze")

        app.dependency_overrides.clear()

        assert response.status_code == 200
        body = response.json()
        assert body["id"] == 1
        assert body["alert_id"] == 10
        assert body["analysis_type"] == "stub"
        assert "summary" in body
        assert "evidence" in body

    @pytest.mark.asyncio
    async def test_analyze_returns_404_when_alert_missing(self):
        """Alert not found → service raises AlertNotFoundError → HTTP 404."""
        mock_db = _mock_db_session()
        app.dependency_overrides[get_db] = lambda: _db_override(mock_db)

        with patch(
            "app.services.orchestrator.SOCAnalysisOrchestrator.analyze_alert",
            new_callable=AsyncMock,
            side_effect=AlertNotFoundError("Alert with id=999 does not exist."),
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as ac:
                response = await ac.post("/api/v1/alerts/999/analyze")

        app.dependency_overrides.clear()

        assert response.status_code == 404
        assert "999" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_analyze_response_has_required_schema_fields(self):
        """Response body contains all top-level AnalysisSchema fields."""
        analysis = _make_analysis(analysis_id=5, alert_id=20)
        mock_db = _mock_db_session()
        app.dependency_overrides[get_db] = lambda: _db_override(mock_db)

        with patch(
            "app.services.orchestrator.SOCAnalysisOrchestrator.analyze_alert",
            new_callable=AsyncMock,
            return_value=analysis,
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as ac:
                response = await ac.post("/api/v1/alerts/20/analyze")

        app.dependency_overrides.clear()

        body = response.json()
        expected_fields = {
            "id", "alert_id", "summary", "severity_assessment",
            "explanation", "recommended_investigation", "confidence",
            "model_name", "analysis_type", "created_at", "evidence",
        }
        assert expected_fields.issubset(body.keys())

    @pytest.mark.asyncio
    async def test_analyze_stub_fields_are_set(self):
        """Stub analysis record contains expected stub marker values."""
        analysis = _make_analysis(analysis_id=2, alert_id=30)
        mock_db = _mock_db_session()
        app.dependency_overrides[get_db] = lambda: _db_override(mock_db)

        with patch(
            "app.services.orchestrator.SOCAnalysisOrchestrator.analyze_alert",
            new_callable=AsyncMock,
            return_value=analysis,
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as ac:
                response = await ac.post("/api/v1/alerts/30/analyze")

        app.dependency_overrides.clear()

        body = response.json()
        assert body["model_name"] == "stub"
        assert body["analysis_type"] == "stub"
        assert body["confidence"] == "0.0"
        assert body["severity_assessment"] == "pending"

    @pytest.mark.asyncio
    async def test_analyze_calls_service_with_correct_alert_id(self):
        """Route passes the path parameter alert_id to the service."""
        analysis = _make_analysis(analysis_id=3, alert_id=42)
        mock_db = _mock_db_session()
        app.dependency_overrides[get_db] = lambda: _db_override(mock_db)

        with patch(
            "app.services.orchestrator.SOCAnalysisOrchestrator.analyze_alert",
            new_callable=AsyncMock,
            return_value=analysis,
        ) as mock_create:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as ac:
                await ac.post("/api/v1/alerts/42/analyze")

        app.dependency_overrides.clear()

        # alert_id is passed as a positional arg: (db, alert_id, data)
        # args[0] = db session, args[1] = alert_id
        call_args = mock_create.call_args
        positional = call_args.args
        keyword = call_args.kwargs
        passed_alert_id = positional[1] if len(positional) > 1 else keyword.get("alert_id")
        assert passed_alert_id == 42


# ---------------------------------------------------------------------------
# GET /api/v1/alerts/{id}/analysis
# ---------------------------------------------------------------------------

class TestGetAnalysisEndpoint:

    @pytest.mark.asyncio
    async def test_returns_200_with_most_recent_analysis(self):
        """Happy path: analysis exists → 200 with AnalysisSchema."""
        analysis = _make_analysis(analysis_id=10, alert_id=5)
        mock_db = _mock_db_session()
        app.dependency_overrides[get_db] = lambda: _db_override(mock_db)

        with patch(
            "app.api.routes.alerts.AnalysisService.get_latest_analysis_for_alert",
            new_callable=AsyncMock,
            return_value=analysis,
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as ac:
                response = await ac.get("/api/v1/alerts/5/analysis")

        app.dependency_overrides.clear()

        assert response.status_code == 200
        body = response.json()
        assert body["id"] == 10
        assert body["alert_id"] == 5
        assert body["evidence"] == []

    @pytest.mark.asyncio
    async def test_get_analysis_returns_404_when_alert_missing(self):
        """Alert does not exist → service raises AlertNotFoundError → 404."""
        mock_db = _mock_db_session()
        app.dependency_overrides[get_db] = lambda: _db_override(mock_db)

        with patch(
            "app.api.routes.alerts.AnalysisService.get_latest_analysis_for_alert",
            new_callable=AsyncMock,
            side_effect=AlertNotFoundError("Alert with id=888 does not exist."),
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as ac:
                response = await ac.get("/api/v1/alerts/888/analysis")

        app.dependency_overrides.clear()

        assert response.status_code == 404
        assert "888" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_get_analysis_returns_404_when_no_analysis_yet(self):
        """Alert exists but no analysis has been run → 404 (not 200 with null)."""
        mock_db = _mock_db_session()
        app.dependency_overrides[get_db] = lambda: _db_override(mock_db)

        with patch(
            "app.api.routes.alerts.AnalysisService.get_latest_analysis_for_alert",
            new_callable=AsyncMock,
            return_value=None,  # alert exists, but no analysis row
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as ac:
                response = await ac.get("/api/v1/alerts/7/analysis")

        app.dependency_overrides.clear()

        assert response.status_code == 404
        detail = response.json()["detail"]
        assert "No analysis found" in detail

    @pytest.mark.asyncio
    async def test_get_analysis_response_shape(self):
        """Response body contains all expected AnalysisSchema fields."""
        analysis = _make_analysis(analysis_id=15, alert_id=3)
        mock_db = _mock_db_session()
        app.dependency_overrides[get_db] = lambda: _db_override(mock_db)

        with patch(
            "app.api.routes.alerts.AnalysisService.get_latest_analysis_for_alert",
            new_callable=AsyncMock,
            return_value=analysis,
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as ac:
                response = await ac.get("/api/v1/alerts/3/analysis")

        app.dependency_overrides.clear()

        body = response.json()
        expected_fields = {
            "id", "alert_id", "summary", "severity_assessment",
            "explanation", "recommended_investigation", "confidence",
            "model_name", "analysis_type", "created_at", "evidence",
        }
        assert expected_fields.issubset(body.keys())

    @pytest.mark.asyncio
    async def test_get_analysis_returns_evidence_list(self):
        """Evidence attached to the analysis is included in the response."""
        from app.db.models.alert import Evidence

        analysis = _make_analysis(analysis_id=20, alert_id=9)
        ev = Evidence()
        ev.id = 100
        ev.analysis_id = 20
        ev.source = "MITRE"
        ev.document_id = "T1110"
        ev.title = "Brute Force"
        ev.content = "Adversary may use brute force..."
        ev.relevance_score = 0.95
        ev.citation = "https://attack.mitre.org/techniques/T1110/"
        analysis.evidence = [ev]

        mock_db = _mock_db_session()
        app.dependency_overrides[get_db] = lambda: _db_override(mock_db)

        with patch(
            "app.api.routes.alerts.AnalysisService.get_latest_analysis_for_alert",
            new_callable=AsyncMock,
            return_value=analysis,
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as ac:
                response = await ac.get("/api/v1/alerts/9/analysis")

        app.dependency_overrides.clear()

        body = response.json()
        assert len(body["evidence"]) == 1
        ev_body = body["evidence"][0]
        assert ev_body["source"] == "MITRE"
        assert ev_body["document_id"] == "T1110"
        assert ev_body["relevance_score"] == 0.95

    @pytest.mark.asyncio
    async def test_get_analysis_calls_service_with_correct_alert_id(self):
        """Route passes the path parameter alert_id to the service."""
        analysis = _make_analysis(analysis_id=99, alert_id=77)
        mock_db = _mock_db_session()
        app.dependency_overrides[get_db] = lambda: _db_override(mock_db)

        with patch(
            "app.api.routes.alerts.AnalysisService.get_latest_analysis_for_alert",
            new_callable=AsyncMock,
            return_value=analysis,
        ) as mock_get:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as ac:
                await ac.get("/api/v1/alerts/77/analysis")

        app.dependency_overrides.clear()

        # alert_id is passed as a positional arg: (db, alert_id)
        # args[0] = db session, args[1] = alert_id
        call_args = mock_get.call_args
        positional = call_args.args
        keyword = call_args.kwargs
        passed_alert_id = positional[1] if len(positional) > 1 else keyword.get("alert_id")
        assert passed_alert_id == 77


# ---------------------------------------------------------------------------
# Route ordering sanity check
# ---------------------------------------------------------------------------

class TestRouteOrderingSanity:
    """Ensure literal sub-paths don't collide with /{alert_id} integer capture."""

    @pytest.mark.asyncio
    async def test_analyze_path_not_captured_as_alert_id(self):
        """GET /alerts/analysis must not be treated as GET /alerts/{alert_id=analysis}."""
        # The literal path /alerts/{id}/analysis should never try to parse
        # "analysis" as an integer alert_id.  This test simply confirms that
        # POSTing to a numeric alert_id's /analyze sub-path returns 200 or 404
        # (not a 422 Unprocessable Entity from a failed integer parse).
        mock_db = _mock_db_session()
        app.dependency_overrides[get_db] = lambda: _db_override(mock_db)

        with patch(
            "app.services.orchestrator.SOCAnalysisOrchestrator.analyze_alert",
            new_callable=AsyncMock,
            side_effect=AlertNotFoundError("Alert with id=1 does not exist."),
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as ac:
                response = await ac.post("/api/v1/alerts/1/analyze")

        app.dependency_overrides.clear()

        # Must be 404 (alert not found), NOT 422 (path parse failure).
        assert response.status_code == 404
