import pytest
from unittest.mock import AsyncMock, MagicMock
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.database import get_db
from app.db.models.alert import Alert, Analysis, Evidence


def _mock_db_session(alert_found=True, with_analysis=True):
    db = AsyncMock()
    
    mock_alert = None
    if alert_found:
        mock_alert = Alert(
            id=1,
            external_alert_id="test-alert-001",
            timestamp="2026-10-17T10:00:00Z",
            severity=10,
            rule_id="5710",
            rule_description="sshd: Attempt to login using a non-existent user",
            agent_name="linux-lab",
            source_ip="192.168.1.100",
            destination_ip="10.0.0.1",
            username="testuser",
            raw_data='{"rule": {"id": "5710", "description": "sshd"}, "agent": {"name": "linux-lab"}}',
            status="open",
        )

    mock_analysis = None
    if with_analysis and alert_found:
        mock_analysis = Analysis(
            id=1,
            alert_id=1,
            summary="Test incident summary.",
            severity_assessment="High risk due to brute force attempt.",
            explanation="Reasoning text.",
            recommended_investigation="Check sshd logs.",
            confidence="HIGH",
            model_name="qwen3:8b",
            analysis_type="evidence_aware",
        )
        ev = Evidence(
            id=1,
            analysis_id=1,
            source="mitre_attack",
            document_id="T1110",
            title="Brute Force",
            content="Brute force description.",
            relevance_score=0.88,
            citation="T1110 - Brute Force",
        )
        mock_analysis.evidence = [ev]

    # Mock execute results
    async def mock_execute(stmt):
        mock_res = MagicMock()
        stmt_str = str(stmt).lower()
        if "analyses" in stmt_str:
            mock_res.scalar_one_or_none.return_value = mock_analysis
        else:
            mock_res.scalar_one_or_none.return_value = mock_alert
        return mock_res

    db.execute = AsyncMock(side_effect=mock_execute)
    return db


@pytest.mark.asyncio
async def test_alert_investigation_graph_endpoint():
    mock_db = _mock_db_session(alert_found=True, with_analysis=True)
    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/v1/alerts/1/graph")
            assert resp.status_code == 200
            data = resp.json()
            assert data["alert_id"] == 1
            assert data["has_analysis"] is True
            assert data["node_count"] > 0
            assert data["edge_count"] > 0

            node_types = {n["type"] for n in data["nodes"]}
            assert "alert" in node_types
            assert "host" in node_types
            assert "user" in node_types
            assert "ip" in node_types
            assert "rule" in node_types
            assert "analysis" in node_types
            assert "evidence" in node_types
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_alert_execution_trace_endpoint():
    mock_db = _mock_db_session(alert_found=True, with_analysis=True)
    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/v1/alerts/1/trace")
            assert resp.status_code == 200
            data = resp.json()
            assert data["alert_id"] == 1
            assert data["has_run"] is True
            assert data["model_name"] == "qwen3:8b"
            assert len(data["stages"]) == 10
            stage_names = [s["name"] for s in data["stages"]]
            assert "Alert Ingestion & Normalization" in stage_names
            assert "Local LLM Inference (Ollama)" in stage_names
            assert "PostgreSQL Analysis Persistence" in stage_names
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_graph_and_trace_for_missing_alert():
    mock_db = _mock_db_session(alert_found=False)
    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            graph_resp = await client.get("/api/v1/alerts/999/graph")
            assert graph_resp.status_code == 404

            trace_resp = await client.get("/api/v1/alerts/999/trace")
            assert trace_resp.status_code == 404
    finally:
        app.dependency_overrides.clear()
