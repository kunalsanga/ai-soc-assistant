"""Integration tests for the Wazuh sync vertical slice.

These require a reachable PostgreSQL matching DATABASE_URL. They are skipped
automatically when the database is unavailable, so `pytest` still passes
offline (unit tests never require external services).
"""
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.db.database import AsyncSessionLocal, engine
from app.main import app


async def _database_available() -> bool:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:  # noqa: BLE001
        return False


pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio,
]


@pytest_asyncio.fixture
async def db_session():
    available = await _database_available()
    if not available:
        pytest.skip("Database not available for integration tests")
    async with AsyncSessionLocal() as session:
        yield session


async def test_sync_mock_alerts_endpoint(db_session):
    # Ensure a clean slate for the external ids used by the mock client.
    await db_session.execute(
        text("DELETE FROM alerts WHERE external_alert_id LIKE 'mock-%'")
    )
    await db_session.commit()

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        response = await ac.post("/api/v1/alerts/sync-mock")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["created"] >= 2
    assert body["client_mode"] == "mock"

    # Second run must be idempotent (dedupe on external_alert_id).
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        response = await ac.post("/api/v1/alerts/sync-mock")
    assert response.status_code == 200
    assert response.json()["created"] == 0
    assert response.json()["duplicates_skipped"] >= 2


async def test_alerts_list_after_sync(db_session):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        response = await ac.get("/api/v1/alerts/")
    assert response.status_code == 200
    alerts = response.json()
    assert isinstance(alerts, list)
    if alerts:
        # Frontend contract intact: fields Bivan's UI expects are present.
        expected_keys = {
            "id",
            "external_alert_id",
            "timestamp",
            "severity",
            "rule_id",
            "rule_description",
            "agent_name",
            "status",
            "created_at",
        }
        assert expected_keys.issubset(alerts[0].keys())
