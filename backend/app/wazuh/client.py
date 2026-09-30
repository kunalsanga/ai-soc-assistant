"""Wazuh client abstraction.

Contract note (intentional, minimal change from the Phase-1 placeholder):
clients return *raw Wazuh alert dicts* instead of `AlertCreate` models so that
normalization stays a separate, testable stage (Phase 3) rather than being
entangled with transport. `MockWazuhClient` is preserved but now emits
realistic, explicitly-marked mock payloads; `RealWazuhClient` talks to a live
Wazuh server configured via environment variables (credentials are never
hardcoded and never logged).

Wazuh is expected to run OUTSIDE this project (VM/lab) — we only consume its
API. The application must keep working without a live Wazuh via mock mode.
"""
from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.wazuh.http import WazuhHttpClient
from app.wazuh.schemas import NormalizedSecurityAlert

logger = logging.getLogger(__name__)

# Well-known Wazuh indexer fields we request explicitly.
_ALERT_SORT = "-timestamp"


class BaseWazuhClient(ABC):
    """Abstract transport-level client over a Wazuh deployment.

    Returns raw Wazuh alert JSON dicts; normalization happens in
    app.security.normalization, not here.
    """

    @abstractmethod
    async def get_alerts(
        self, limit: int = 10, offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Fetch a list of raw Wazuh alerts."""

    @abstractmethod
    async def get_alert(self, alert_id: str) -> Optional[Dict[str, Any]]:
        """Fetch a single raw Wazuh alert by its Wazuh alert id."""

    @abstractmethod
    async def search_alerts(
        self,
        query: Optional[str] = None,
        rule_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        min_severity: Optional[int] = None,
        limit: int = 10,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """Search raw Wazuh alerts with simple structured filters."""

    @abstractmethod
    async def health_check(self) -> bool:
        """Return True if the Wazuh deployment is reachable/authenticated."""

    @property
    @abstractmethod
    def mode(self) -> str:
        """Client mode label, e.g. 'mock' or 'real'."""


class MockWazuhClient(BaseWazuhClient):
    """Development client. Data is EXPLICITLY mock — never presented as real.

    Payloads mirror realistic Wazuh alert shapes (rule, agent, data blocks)
    so normalization and preprocessing are exercised end-to-end offline.
    """

    def __init__(self) -> None:
        self._alerts: List[Dict[str, Any]] = [
            {
                "id": "mock-001",
                "timestamp": "2026-05-20T10:00:00.000+0000",
                "rule": {
                    "id": "5710",
                    "level": 10,
                    "description": "sshd: Attempt to login using a non-existent user",
                    "groups": ["authentication_failed", "syslog"],
                    "mitre": {"id": ["T1110"], "tactic": ["Credential Access"]},
                },
                "agent": {
                    "id": "001",
                    "name": "linux-lab",
                    "os": {"name": "Ubuntu", "version": "22.04"},
                },
                "data": {
                    "srcip": "192.168.1.20",
                    "srcport": 51234,
                    "dstuser": "test-user",
                    "protocol": "sshd",
                },
                "location": "/var/log/auth.log",
            },
            {
                "id": "mock-002",
                "timestamp": "2026-05-20T10:15:00.000+0000",
                "rule": {
                    "id": "100001",
                    "level": 12,
                    "description": "Suspicious binary execution detected",
                    "groups": ["syscheck", "pci_dss"],
                },
                "agent": {
                    "id": "002",
                    "name": "win-desktop-01",
                    "os": {"name": "Windows", "version": "11"},
                },
                "data": {
                    "dstip": "10.0.0.8",
                    "dstport": 4444,
                    "dstuser": "admin",
                    "process": "powershell.exe",
                    "file": "C:\\\\Users\\\\admin\\\\AppData\\\\Local\\\\Temp\\\\svchost.exe",
                },
                "location": "Syscheck",
            },
            {
                # Deliberately sparse alert: normalization must tolerate
                # missing fields gracefully (never assume fields exist).
                "id": "mock-003",
                "timestamp": "2026-05-20T10:30:00.000+0000",
                "rule": {"id": "31151", "level": 5, "description": "Web scanner activity"},
                "location": "/var/log/nginx/access.log",
            },
        ]

    async def get_alerts(
        self, limit: int = 10, offset: int = 0
    ) -> List[Dict[str, Any]]:
        return self._alerts[offset:offset + limit]

    async def get_alert(self, alert_id: str) -> Optional[Dict[str, Any]]:
        for alert in self._alerts:
            if str(alert.get("id")) == str(alert_id):
                return alert
        return None

    async def search_alerts(
        self,
        query: Optional[str] = None,
        rule_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        min_severity: Optional[int] = None,
        limit: int = 10,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        def matches(alert: Dict[str, Any]) -> bool:
            if rule_id and str(alert.get("rule", {}).get("id")) != str(rule_id):
                return False
            if agent_id and str(alert.get("agent", {}).get("id")) != str(agent_id):
                return False
            if min_severity is not None:
                if int(alert.get("rule", {}).get("level", 0)) < min_severity:
                    return False
            if query:
                haystack = str(alert).lower()
                if query.lower() not in haystack:
                    return False
            return True

        matched = [a for a in self._alerts if matches(a)]
        return matched[offset:offset + limit]

    async def health_check(self) -> bool:
        return True

    @property
    def mode(self) -> str:
        return "mock"


class RealWazuhClient(BaseWazuhClient):
    """Client for a live Wazuh server (WAZUH_BASE_URL + credentials from env).

    Uses the Wazuh Manager API (`GET /alerts` via the manager's alert
    endpoints) with graceful degradation to the Indexer API shape when the
    manager endpoint is unavailable. Configuration is env-driven only.
    """

    def __init__(self) -> None:
        base_url = (
            settings.WAZUH_BASE_URL
            or settings.WAZUH_API_URL
            or ""
        ).strip()
        if not base_url:
            raise ValueError(
                "RealWazuhClient requires WAZUH_BASE_URL (or WAZUH_API_URL) to be set"
            )
        self._http = WazuhHttpClient(
            base_url=base_url,
            username=settings.WAZUH_USERNAME,
            password=settings.WAZUH_PASSWORD,
            verify_ssl=settings.WAZUH_VERIFY_SSL,
        )

    @property
    def mode(self) -> str:
        return "real"

    async def get_alerts(
        self, limit: int = 10, offset: int = 0
    ) -> List[Dict[str, Any]]:
        params: Dict[str, Any] = {"limit": limit, "offset": offset, "sort": _ALERT_SORT}
        body = await self._http.request("GET", "/alerts", params=params)
        return self._extract_alerts(body)

    async def get_alert(self, alert_id: str) -> Optional[Dict[str, Any]]:
        # The manager API exposes alert listing with q= filters rather than a
        # direct by-id fetch; query by exact id.
        params = {"limit": 1, "q": f'id="{alert_id}"'}
        body = await self._http.request("GET", "/alerts", params=params)
        alerts = self._extract_alerts(body)
        if not alerts:
            return None
        for alert in alerts:
            if str(alert.get("id")) == str(alert_id):
                return alert
        return None

    async def search_alerts(
        self,
        query: Optional[str] = None,
        rule_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        min_severity: Optional[int] = None,
        limit: int = 10,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        clauses: List[str] = []
        if rule_id:
            clauses.append(f'rule.id="{rule_id}"')
        if agent_id:
            clauses.append(f'agent.id="{agent_id}"')
        if min_severity is not None:
            clauses.append(f"rule.level>={int(min_severity)}")
        if query:
            # Full-text-ish search over the alert body.
            clauses.append(f"({query})")
        params: Dict[str, Any] = {"limit": limit, "offset": offset, "sort": _ALERT_SORT}
        if clauses:
            params["q"] = " and ".join(clauses)
        body = await self._http.request("GET", "/alerts", params=params)
        return self._extract_alerts(body)

    async def health_check(self) -> bool:
        try:
            await self._http.request("GET", "/")
            return True
        except Exception as exc:  # noqa: BLE001 - health check must not raise
            logger.warning("wazuh_health_check_failed error=%s", exc)
            return False

    async def close(self) -> None:
        await self._http.close()

    @staticmethod
    def _extract_alerts(body: Any) -> List[Dict[str, Any]]:
        """Pull the alert list out of common Wazuh API response shapes."""
        if isinstance(body, dict):
            data = body.get("data", body)
            if isinstance(data, dict):
                items = data.get("affected_items", data.get("hits", data.get("alerts")))
                if items is None:
                    return []
                if isinstance(items, dict):  # indexer-style hits.hits
                    items = items.get("hits", [])
                if isinstance(items, list):
                    return [
                        hit.get("_source", hit) if isinstance(hit, dict) else hit
                        for hit in items
                        if isinstance(hit, dict)
                    ]
            if isinstance(data, list):
                return [a for a in data if isinstance(a, dict)]
        return []


def get_wazuh_client() -> BaseWazuhClient:
    """Factory: mock unless explicitly configured for a real Wazuh server.

    Keeps the same import path the existing routes already use
    (app.wazuh.client.get_wazuh_client), so nothing else changes.
    """
    if settings.WAZUH_MODE.lower() == "real":
        return RealWazuhClient()
    return MockWazuhClient()
