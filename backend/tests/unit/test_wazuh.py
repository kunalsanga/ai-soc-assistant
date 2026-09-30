import pytest
from app.wazuh.client import MockWazuhClient, get_wazuh_client


@pytest.mark.asyncio
async def test_mock_wazuh_client():
    client = MockWazuhClient()
    alerts = await client.get_alerts()
    assert len(alerts) > 0

    alert_id = alerts[0]["id"]
    alert = await client.get_alert(alert_id)
    assert alert is not None
    assert str(alert["id"]) == str(alert_id)


@pytest.mark.asyncio
async def test_mock_client_search_filters():
    client = MockWazuhClient()

    by_rule = await client.search_alerts(rule_id="5710")
    assert len(by_rule) == 1
    assert by_rule[0]["rule"]["id"] == "5710"

    by_agent = await client.search_alerts(agent_id="002")
    assert len(by_agent) == 1
    assert by_agent[0]["agent"]["name"] == "win-desktop-01"

    by_severity = await client.search_alerts(min_severity=10)
    assert all(int(a["rule"]["level"]) >= 10 for a in by_severity)
    assert len(by_severity) == 2


@pytest.mark.asyncio
async def test_mock_client_health_and_mode():
    client = MockWazuhClient()
    assert await client.health_check() is True
    assert client.mode == "mock"


def test_factory_defaults_to_mock():
    client = get_wazuh_client()
    # Default configuration (no WAZUH_MODE=real in test env) must be mock.
    assert client.mode == "mock"


@pytest.mark.asyncio
async def test_mock_alerts_are_explicitly_mock_payloads():
    """Mock data must be recognizably mock (spec section 7): the fixed ids
    are namespaced with the 'mock-' prefix so they can never be mistaken
    for real Wazuh numeric alert ids."""
    client = MockWazuhClient()
    for alert in await client.get_alerts():
        assert str(alert["id"]).startswith("mock-")
