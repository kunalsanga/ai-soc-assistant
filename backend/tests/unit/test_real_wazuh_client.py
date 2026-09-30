"""Unit tests for RealWazuhClient transport behavior.

All HTTP traffic is faked via the shared WazuhHttpClient's request path —
no real Wazuh server or credentials are needed.
"""
import httpx
import pytest

from app.core.config import settings
from app.wazuh.client import RealWazuhClient
from app.wazuh.exceptions import (
    WazuhAuthenticationError,
    WazuhConnectionError,
    WazuhResponseError,
)
from app.wazuh.http import WazuhHttpClient


def _make_client(handler) -> RealWazuhClient:
    """Build a RealWazuhClient whose HTTP transport is replaced by a fake."""
    client = RealWazuhClient.__new__(RealWazuhClient)
    http = WazuhHttpClient(
        base_url="https://wazuh.example:55000",
        username="u",
        password="p",
        verify_ssl=True,
    )
    http._client = httpx.AsyncClient(
        base_url="https://wazuh.example:55000",
        transport=httpx.MockTransport(handler),
        verify=True,
    )
    client._http = http
    return client


AUTH_OK = {"data": {"token": "test-token"}}


def _auth_handler(alerts_payload: dict):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/security/user/authenticate":
            return httpx.Response(200, json=AUTH_OK)
        if request.url.path == "/alerts":
            return httpx.Response(200, json=alerts_payload)
        return httpx.Response(404, json={"error": "not found"})

    return handler


MANAGER_ALERTS = {
    "data": {
        "affected_items": [
            {"id": "100.1", "rule": {"id": "5710", "level": 10}},
            {"id": "100.2", "rule": {"id": "31151", "level": 5}},
        ]
    }
}


@pytest.mark.asyncio
async def test_get_alerts_manager_shape():
    client = _make_client(_auth_handler(MANAGER_ALERTS))
    alerts = await client.get_alerts()
    assert [a["id"] for a in alerts] == ["100.1", "100.2"]
    await client.close()


@pytest.mark.asyncio
async def test_extract_alerts_indexer_shape():
    """Indexer-style hits.hits payloads must be handled too."""
    body = {
        "hits": {
            "hits": [
                {"_source": {"id": "200.1", "rule": {"level": 7}}},
            ]
        }
    }
    alerts = RealWazuhClient._extract_alerts(body)
    assert alerts == [{"id": "200.1", "rule": {"level": 7}}]


@pytest.mark.asyncio
async def test_get_alert_by_id():
    client = _make_client(_auth_handler(MANAGER_ALERTS))
    alert = await client.get_alert("100.2")
    assert alert is not None
    assert alert["id"] == "100.2"

    missing = await client.get_alert("does-not-exist")
    assert missing is None
    await client.close()


@pytest.mark.asyncio
async def test_auth_failure_raises_specific_error():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": "invalid credentials"})

    client = _make_client(handler)
    with pytest.raises(WazuhAuthenticationError):
        await client.get_alerts()


@pytest.mark.asyncio
async def test_network_failure_maps_to_connection_error():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    client = _make_client(handler)
    with pytest.raises(WazuhConnectionError):
        await client.get_alerts()


@pytest.mark.asyncio
async def test_http_error_maps_to_response_error():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/security/user/authenticate":
            return httpx.Response(200, json=AUTH_OK)
        return httpx.Response(500, text="boom")

    client = _make_client(handler)
    with pytest.raises(WazuhResponseError):
        await client.get_alerts()


@pytest.mark.asyncio
async def test_health_check_returns_bool_never_raises():
    def ok_handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/security/user/authenticate":
            return httpx.Response(200, json=AUTH_OK)
        return httpx.Response(200, json={"data": {}})

    client = _make_client(ok_handler)
    assert await client.health_check() is True
    await client.close()


@pytest.mark.asyncio
async def test_health_check_false_on_outage():
    def dead_handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down")

    client = _make_client(dead_handler)
    assert await client.health_check() is False


def test_real_client_requires_base_url(monkeypatch):
    monkeypatch.setattr(settings, "WAZUH_BASE_URL", "")
    monkeypatch.setattr(settings, "WAZUH_API_URL", "")
    with pytest.raises(ValueError):
        RealWazuhClient()


def test_verify_ssl_setting_exists():
    """WAZUH_VERIFY_SSL must be configurable (spec section 6)."""
    assert isinstance(settings.WAZUH_VERIFY_SSL, bool)
