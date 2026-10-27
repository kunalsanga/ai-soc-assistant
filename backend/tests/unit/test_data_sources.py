"""Unit tests for multi-source data architecture, provenance, and isolation."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.datasources.schemas import (
    DataSourceInfo,
    DataSourcesSummary,
    DataSourceType,
    SourceProvenance,
    SourceStatus,
)
from app.datasources.manager import DataSourceManager
from app.wazuh.indexer import WazuhIndexerClient
from app.wazuh.exceptions import WazuhAuthenticationError, WazuhConnectionError


def test_normalize_source():
    assert DataSourceManager.normalize_source("demo") == DataSourceType.DEMO
    assert DataSourceManager.normalize_source("synthetic") == DataSourceType.DEMO
    assert DataSourceManager.normalize_source("mock") == DataSourceType.DEMO
    assert DataSourceManager.normalize_source("live_wazuh") == DataSourceType.LIVE_WAZUH
    assert DataSourceManager.normalize_source("real") == DataSourceType.LIVE_WAZUH
    assert DataSourceManager.normalize_source("wazuh") == DataSourceType.LIVE_WAZUH
    assert DataSourceManager.normalize_source("dataset_replay") == DataSourceType.DATASET_REPLAY
    assert DataSourceManager.normalize_source("historical") == DataSourceType.DATASET_REPLAY
    assert DataSourceManager.normalize_source(None) == DataSourceType.DEMO
    assert DataSourceManager.normalize_source("unknown_xyz") == DataSourceType.DEMO


def test_provenance_schema():
    prov = SourceProvenance(
        source_type=DataSourceType.LIVE_WAZUH,
        original_event_id="wazuh-10023",
        event_timestamp="2026-10-26T08:00:00Z",
        ingestion_timestamp="2026-10-26T08:05:00Z",
        connector_type="indexer",
    )
    assert prov.source_type == DataSourceType.LIVE_WAZUH
    assert prov.original_event_id == "wazuh-10023"
    assert prov.connector_type == "indexer"


@pytest.mark.asyncio
async def test_wazuh_indexer_unconfigured_error():
    client = WazuhIndexerClient(base_url="", username="", password="")
    assert not client.is_configured
    assert not await client.health_check()
    with pytest.raises(WazuhAuthenticationError) as exc_info:
        await client.get_alerts()
    assert "not configured" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_wazuh_indexer_search_parsing():
    client = WazuhIndexerClient(
        base_url="https://wazuh-mock-indexer:9200",
        username="admin",
        password="password",
    )
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "hits": {
            "total": {"value": 2},
            "hits": [
                {
                    "_id": "doc-1",
                    "_source": {
                        "id": "alert-101",
                        "timestamp": "2026-10-26T09:00:00Z",
                        "rule": {"id": "5710", "level": 10, "description": "SSH attempt"},
                        "agent": {"id": "001", "name": "srv-prod-01"},
                    },
                },
                {
                    "_id": "doc-2",
                    "_source": {
                        "timestamp": "2026-10-26T09:05:00Z",
                        "rule": {"id": "5715", "level": 12, "description": "Root login"},
                        "agent": {"id": "001", "name": "srv-prod-01"},
                    },
                },
            ],
        }
    }

    with patch.object(client, "_get_client", new_callable=AsyncMock) as mock_get:
        mock_http = AsyncMock()
        mock_http.post.return_value = mock_response
        mock_get.return_value = mock_http

        alerts = await client.get_alerts(limit=10)
        assert len(alerts) == 2
        assert alerts[0]["id"] == "alert-101"
        assert alerts[0]["rule"]["level"] == 10
        # doc-2 didn't have id in _source, should be filled with _id
        assert alerts[1]["id"] == "doc-2"


@pytest.mark.asyncio
async def test_wazuh_indexer_connection_failure():
    client = WazuhIndexerClient(
        base_url="https://unreachable-indexer:9200",
        username="admin",
        password="password",
    )
    with patch.object(client, "_get_client", new_callable=AsyncMock) as mock_get:
        mock_http = AsyncMock()
        import httpx
        mock_http.post.side_effect = httpx.ConnectError("Connection refused")
        mock_get.return_value = mock_http

        with pytest.raises(WazuhConnectionError) as exc_info:
            await client.get_alerts()
        assert "cannot reach wazuh indexer" in str(exc_info.value).lower()
