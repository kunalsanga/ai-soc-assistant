import pytest
from app.wazuh.client import MockWazuhClient

@pytest.mark.asyncio
async def test_mock_wazuh_client():
    client = MockWazuhClient()
    alerts = await client.get_alerts()
    assert len(alerts) > 0
    
    alert = await client.get_alert(alerts[0].external_alert_id)
    assert alert is not None
    assert alert.external_alert_id == alerts[0].external_alert_id
