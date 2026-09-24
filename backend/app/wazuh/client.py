from typing import List, Optional
from abc import ABC, abstractmethod
from app.schemas.alert import AlertCreate

class BaseWazuhClient(ABC):
    @abstractmethod
    async def get_alerts(self, limit: int = 10, offset: int = 0) -> List[AlertCreate]:
        pass

    @abstractmethod
    async def get_alert(self, alert_id: str) -> Optional[AlertCreate]:
        pass

class MockWazuhClient(BaseWazuhClient):
    def __init__(self):
        self.mock_alerts = [
            AlertCreate(
                external_alert_id="mock-001",
                timestamp="2024-05-20T10:00:00Z",
                severity=10,
                rule_id="5710",
                rule_description="Multiple authentication failures",
                agent_name="linux-lab",
                source_ip="192.168.1.20",
                username="test-user"
            ),
            AlertCreate(
                external_alert_id="mock-002",
                timestamp="2024-05-20T10:15:00Z",
                severity=12,
                rule_id="100001",
                rule_description="Suspicious binary execution",
                agent_name="win-desktop-01",
                username="admin"
            )
        ]

    async def get_alerts(self, limit: int = 10, offset: int = 0) -> List[AlertCreate]:
        return self.mock_alerts[offset:offset+limit]

    async def get_alert(self, alert_id: str) -> Optional[AlertCreate]:
        for alert in self.mock_alerts:
            if alert.external_alert_id == alert_id:
                return alert
        return None

def get_wazuh_client() -> BaseWazuhClient:
    # In the future, this can switch based on config settings
    return MockWazuhClient()
