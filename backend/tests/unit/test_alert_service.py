"""Unit tests for the AlertService sync flow (Phase 2 vertical slice).

The database session is mocked; no real PostgreSQL is required. Wazuh is
stubbed with deterministic in-memory payloads.
"""
import json
from typing import Any, Dict, List, Optional
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.db.models.alert import Alert
from app.wazuh.client import BaseWazuhClient
from app.wazuh.exceptions import WazuhConnectionError
from app.wazuh.service import AlertService


class StubWazuhClient(BaseWazuhClient):
    """Deterministic stub implementing the raw-dict client contract."""

    def __init__(self, alerts: List[Dict[str, Any]], fail: bool = False):
        self._alerts = alerts
        self._fail = fail

    @property
    def mode(self) -> str:
        return "mock"

    async def get_alerts(self, limit: int = 10, offset: int = 0) -> List[Dict[str, Any]]:
        if self._fail:
            raise WazuhConnectionError("simulated wazuh outage")
        return self._alerts[offset:offset + limit]

    async def get_alert(self, alert_id: str) -> Optional[Dict[str, Any]]:
        for alert in self._alerts:
            if str(alert.get("id")) == str(alert_id):
                return alert
        return None

    async def search_alerts(self, **kwargs) -> List[Dict[str, Any]]:
        return self._alerts

    async def health_check(self) -> bool:
        return not self._fail


def _raw_alert(external_id: str, level: int = 10) -> Dict[str, Any]:
    return {
        "id": external_id,
        "timestamp": "2026-05-20T10:00:00.000+0000",
        "rule": {"id": "5710", "level": level, "description": "Auth failure"},
        "agent": {"id": "001", "name": "linux-lab"},
        "data": {"srcip": "192.168.1.20", "dstuser": "alice"},
    }


def _mock_db() -> AsyncMock:
    """Async DB session mock: no existing rows -> every alert is new.

    Note: SQLAlchemy's Result.scalar_one_or_none() is synchronous, so the
    result object is a MagicMock with a sync method; only db.execute is async.
    """
    db = AsyncMock()
    empty_result = MagicMock()
    empty_result.scalar_one_or_none.return_value = None
    db.execute = AsyncMock(return_value=empty_result)
    return db


@pytest.mark.asyncio
async def test_sync_creates_alerts():
    db = _mock_db()
    service = AlertService(client=StubWazuhClient([_raw_alert("a-1"), _raw_alert("a-2")]))

    result = await service.sync_alerts(db)

    assert result.fetched == 2
    assert result.created == 2
    assert result.duplicates_skipped == 0
    assert result.external_alert_ids == ["a-1", "a-2"]
    assert db.add.call_count == 2
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_sync_is_idempotent_on_external_id():
    """Second sync of the same payload must not create duplicates."""
    db = _mock_db()
    service = AlertService(client=StubWazuhClient([_raw_alert("a-1")]))

    await service.sync_alerts(db)
    adds_after_first_sync = db.add.call_count

    # Simulate the alert already existing on the next run.
    existing_result = MagicMock()
    existing_row = Alert(external_alert_id="a-1")
    existing_result.scalar_one_or_none.return_value = existing_row
    db.execute = AsyncMock(return_value=existing_result)

    result = await service.sync_alerts(db)

    assert result.fetched == 1
    assert result.created == 0
    assert result.duplicates_skipped == 1
    # No additional insert during the duplicate pass.
    assert db.add.call_count == adds_after_first_sync


@pytest.mark.asyncio
async def test_sync_skips_malformed_alerts_without_failing_batch():
    db = _mock_db()
    service = AlertService(
        client=StubWazuhClient([{"rule": {"level": 3}}, _raw_alert("a-good")])
    )

    result = await service.sync_alerts(db)

    assert result.created == 1
    assert result.external_alert_ids == ["a-good"]


@pytest.mark.asyncio
async def test_sync_persists_raw_wazuh_data():
    db = _mock_db()
    raw = _raw_alert("a-raw")
    service = AlertService(client=StubWazuhClient([raw]))

    await service.sync_alerts(db)

    added_alert: Alert = db.add.call_args[0][0]
    assert added_alert.external_alert_id == "a-raw"
    assert added_alert.status == "open"
    # Raw payload must be preserved as JSON for audit/debug.
    assert json.loads(added_alert.raw_data) == raw


@pytest.mark.asyncio
async def test_sync_surfaces_wazuh_errors():
    db = _mock_db()
    service = AlertService(client=StubWazuhClient([], fail=True))

    with pytest.raises(WazuhConnectionError):
        await service.sync_alerts(db)

    db.commit.assert_not_awaited()
