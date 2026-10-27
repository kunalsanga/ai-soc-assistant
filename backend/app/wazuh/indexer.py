"""Wazuh Indexer (OpenSearch API) connector.

Read-only client querying the Wazuh Indexer cluster directly via OpenSearch
REST API (`POST /wazuh-alerts-*/_search`).

Design Principles:
1. Strict read-only query pattern (no index creation, writing, or deletion).
2. Authenticated transport via HTTP Basic Auth over TLS with proper certificate handling.
3. Clean error isolation: unconfigured credentials raise an explicit UnconfiguredError
   rather than pretending to connect or returning fake data.
4. Returns raw Wazuh alert dicts (_source payload) compatible with existing
   normalization pipeline.
"""
from __future__ import annotations

import logging
import ssl
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings
from app.wazuh.client import BaseWazuhClient
from app.wazuh.exceptions import (
    WazuhAuthenticationError,
    WazuhConnectionError,
    WazuhError,
    WazuhResponseError,
)

logger = logging.getLogger(__name__)

DEFAULT_INDEXER_TIMEOUT = 15.0


class WazuhIndexerClient(BaseWazuhClient):
    """Client for Wazuh Indexer OpenSearch cluster (default port 9200)."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        index_pattern: Optional[str] = None,
        verify_ssl: Optional[bool] = None,
        ca_bundle: Optional[str] = None,
        timeout: float = DEFAULT_INDEXER_TIMEOUT,
    ) -> None:
        raw_url = base_url or settings.WAZUH_INDEXER_URL or ""
        self._base_url = raw_url.strip().rstrip("/")
        self._username = (username or settings.WAZUH_INDEXER_USERNAME or "").strip()
        self._password = (password or settings.WAZUH_INDEXER_PASSWORD or "").strip()
        self._index_pattern = (index_pattern or settings.WAZUH_INDEX_PATTERN or "wazuh-alerts-*").strip()
        self._verify_ssl = settings.WAZUH_VERIFY_SSL if verify_ssl is None else verify_ssl
        self._ca_bundle = ca_bundle or settings.WAZUH_CA_BUNDLE or ""
        self._timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def mode(self) -> str:
        return "live_wazuh_indexer"

    @property
    def is_configured(self) -> bool:
        return bool(self._base_url and self._username and self._password)

    def _ensure_configured(self) -> None:
        if not self.is_configured:
            raise WazuhAuthenticationError(
                "Wazuh Indexer is not configured: set WAZUH_INDEXER_URL, "
                "WAZUH_INDEXER_USERNAME, and WAZUH_INDEXER_PASSWORD in .env"
            )

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            verify: Any = self._verify_ssl
            if self._verify_ssl and self._ca_bundle:
                verify = self._ca_bundle

            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                verify=verify,
                timeout=self._timeout,
                auth=httpx.BasicAuth(self._username, self._password),
                headers={"Content-Type": "application/json"},
            )
        return self._client

    async def close(self) -> None:
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()

    async def health_check(self) -> bool:
        if not self.is_configured:
            return False
        try:
            client = await self._get_client()
            resp = await client.get("/")
            return resp.status_code == 200
        except Exception as exc:  # noqa: BLE001
            logger.warning("wazuh_indexer_health_check_failed error=%s", exc)
            return False

    async def get_alerts(
        self, limit: int = 10, offset: int = 0
    ) -> List[Dict[str, Any]]:
        self._ensure_configured()
        body = {
            "size": limit,
            "from": offset,
            "sort": [{"timestamp": {"order": "desc"}}],
            "query": {"match_all": {}},
        }
        return await self._execute_search(body)

    async def get_alert(self, alert_id: str) -> Optional[Dict[str, Any]]:
        self._ensure_configured()
        body = {
            "size": 1,
            "query": {
                "bool": {
                    "should": [
                        {"term": {"id": alert_id}},
                        {"term": {"_id": alert_id}},
                        {"term": {"id.keyword": alert_id}},
                    ]
                }
            },
        }
        hits = await self._execute_search(body)
        return hits[0] if hits else None

    async def search_alerts(
        self,
        query: Optional[str] = None,
        rule_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        min_severity: Optional[int] = None,
        limit: int = 10,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        self._ensure_configured()
        must_clauses: List[Dict[str, Any]] = []

        if rule_id:
            must_clauses.append({"term": {"rule.id": rule_id}})
        if agent_id:
            must_clauses.append({"term": {"agent.id": agent_id}})
        if min_severity is not None:
            must_clauses.append({"range": {"rule.level": {"gte": int(min_severity)}}})
        if query:
            must_clauses.append({"query_string": {"query": query}})

        body: Dict[str, Any] = {
            "size": limit,
            "from": offset,
            "sort": [{"timestamp": {"order": "desc"}}],
            "query": {"bool": {"must": must_clauses}} if must_clauses else {"match_all": {}},
        }
        return await self._execute_search(body)

    async def _execute_search(self, search_body: Dict[str, Any]) -> List[Dict[str, Any]]:
        client = await self._get_client()
        path = f"/{self._index_pattern}/_search"
        try:
            response = await client.post(path, json=search_body)
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            raise WazuhConnectionError(f"Cannot reach Wazuh Indexer at {self._base_url}: {exc}") from exc

        if response.status_code in (401, 403):
            raise WazuhAuthenticationError(
                "Wazuh Indexer authentication failed: verify WAZUH_INDEXER_USERNAME / WAZUH_INDEXER_PASSWORD",
                status_code=response.status_code,
            )
        if response.status_code >= 400:
            raise WazuhResponseError(
                f"Wazuh Indexer returned HTTP {response.status_code}: {response.text[:200]}",
                status_code=response.status_code,
            )

        try:
            data = response.json()
        except Exception as exc:
            raise WazuhResponseError("Wazuh Indexer returned non-JSON response") from exc

        hits = data.get("hits", {}).get("hits", [])
        results: List[Dict[str, Any]] = []
        for hit in hits:
            source = hit.get("_source", {})
            if isinstance(source, dict):
                # Ensure the original document id is preserved if not in source
                if "id" not in source and "_id" in hit:
                    source["id"] = hit["_id"]
                results.append(source)
        return results
