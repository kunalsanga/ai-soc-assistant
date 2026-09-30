"""Shared HTTP infrastructure for Wazuh API clients.

Transport concerns only (base URL, auth token lifecycle, timeouts, logging).
Credentials are never logged. Structured latency tracking is exposed so the
analysis orchestrator can record `wazuh_latency` (section 29).
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Dict, Optional

import httpx

from app.wazuh.exceptions import (
    WazuhAuthenticationError,
    WazuhConnectionError,
    WazuhResponseError,
)

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_SECONDS = 15.0


class WazuhHttpClient:
    """Thin httpx wrapper handling base URL, auth token lifecycle, and timeouts.

    Responsibilities are deliberately limited to transport concerns:
    - token acquisition and transparent refresh on 401 (one retry)
    - verify_ssl handling for self-signed lab certificates
    - mapping transport failures to explicit Wazuh* exceptions
    """

    def __init__(
        self,
        base_url: str,
        username: str,
        password: str,
        verify_ssl: bool = True,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
    ) -> None:
        if not base_url:
            raise ValueError("Wazuh base URL must be configured for the real client")
        self._base_url = base_url.rstrip("/")
        self._username = username
        self._password = password
        self._verify_ssl = verify_ssl
        self._timeout = timeout
        self._token: Optional[str] = None
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                verify=self._verify_ssl,
                timeout=self._timeout,
            )
        return self._client

    async def close(self) -> None:
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()

    async def _fetch_token(self) -> str:
        client = await self._get_client()
        start = time.perf_counter()
        try:
            response = await client.post(
                "/security/user/authenticate",
                auth=httpx.BasicAuth(self._username, self._password),
            )
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            raise WazuhConnectionError(f"Cannot reach Wazuh API: {exc}") from exc

        if response.status_code in (401, 403):
            # Never include credentials in the message.
            raise WazuhAuthenticationError(
                "Wazuh authentication failed: check WAZUH_USERNAME/WAZUH_PASSWORD",
                status_code=response.status_code,
            )
        if response.status_code >= 400:
            raise WazuhResponseError(
                f"Wazuh auth endpoint returned HTTP {response.status_code}",
                status_code=response.status_code,
            )

        try:
            token = response.json()["data"]["token"]
        except (ValueError, KeyError) as exc:
            raise WazuhResponseError(
                "Wazuh auth response did not contain the expected token payload"
            ) from exc

        self._token = token
        logger.info(
            "wazuh_auth_ok latency_ms=%.1f", (time.perf_counter() - start) * 1000
        )
        return token

    async def request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        _retry_on_auth: bool = True,
    ) -> Any:
        """Perform an authenticated JSON request; returns parsed JSON body.

        - refreshes the token once on 401
        - raises WazuhConnectionError on network/timeout failures
        - raises WazuhResponseError on non-2xx or non-JSON responses
        """
        client = await self._get_client()
        if self._token is None:
            await self._fetch_token()

        start = time.perf_counter()
        try:
            response = await client.request(
                method,
                path,
                params=params,
                headers={"Authorization": f"Bearer {self._token}"},
            )
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            raise WazuhConnectionError(f"Cannot reach Wazuh API: {exc}") from exc

        if response.status_code == 401 and _retry_on_auth:
            logger.info("wazuh_token_expired refreshing")
            self._token = None
            await self._fetch_token()
            return await self.request(
                method, path, params=params, _retry_on_auth=False
            )

        latency_ms = (time.perf_counter() - start) * 1000
        if response.status_code >= 400:
            raise WazuhResponseError(
                f"Wazuh API {method} {path} returned HTTP {response.status_code}",
                status_code=response.status_code,
            )
        try:
            body = response.json()
        except ValueError as exc:
            raise WazuhResponseError(
                f"Wazuh API {method} {path} returned non-JSON response"
            ) from exc

        logger.info(
            "wazuh_request_ok method=%s path=%s status=%d latency_ms=%.1f",
            method,
            path,
            response.status_code,
            latency_ms,
        )
        return body
