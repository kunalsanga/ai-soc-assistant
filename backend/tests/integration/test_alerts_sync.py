"""Integration tests for the Wazuh sync vertical slice.

These tests use a safe, isolated transactional fixture with savepoint rollback
so that NO records in the development or production database are ever deleted or
persisted permanently.

They require a reachable PostgreSQL matching DATABASE_URL (or TEST_DATABASE_URL).
They are skipped automatically when the database is unavailable, so `pytest` still passes
offline (unit tests never require external services).
"""
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import AsyncSessionLocal, engine, get_db
from app.main import app


async def _database_available() -> bool:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:  # noqa: BLE001
        return False
    finally:
        await engine.dispose()


pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio,
]


@pytest_asyncio.fixture
async def safe_db_session():
    """Transactional fixture that rolls back all database modifications at test teardown.

    Never deletes or alters development database state permanently.
    Overrides FastAPI's get_db dependency so endpoint operations share the savepoint.
    """
    available = await _database_available()
    if not available:
        pytest.skip("Database not available for integration tests")

    async with engine.connect() as connection:
        transaction = await connection.begin()
        session = AsyncSession(
            bind=connection,
            join_transaction_mode="create_savepoint",
            expire_on_commit=False,
        )

        # Clean slate for mock alerts ONLY within this isolated transaction
        await session.execute(
            text(
                "DELETE FROM evidence WHERE analysis_id IN (SELECT id FROM analyses WHERE alert_id IN (SELECT id FROM alerts WHERE external_alert_id LIKE 'mock-%'))"
            )
        )
        await session.execute(
            text(
                "DELETE FROM analyses WHERE alert_id IN (SELECT id FROM alerts WHERE external_alert_id LIKE 'mock-%')"
            )
        )
        await session.execute(
            text("DELETE FROM alerts WHERE external_alert_id LIKE 'mock-%'")
        )
        await session.commit()

        async def _override_get_db():
            yield session

        app.dependency_overrides[get_db] = _override_get_db

        try:
            yield session
        finally:
            app.dependency_overrides.pop(get_db, None)
            await session.close()
            await transaction.rollback()
            await engine.dispose()


async def test_sync_mock_alerts_endpoint(safe_db_session):
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


async def test_alerts_list_after_sync(safe_db_session):
    # Ensure sync occurred in this transaction
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        await ac.post("/api/v1/alerts/sync-mock")
        response = await ac.get("/api/v1/alerts/")
    assert response.status_code == 200
    alerts = response.json()
    assert isinstance(alerts, list)
    if alerts:
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
