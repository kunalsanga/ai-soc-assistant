"""Explicit, non-generic errors for the Wazuh integration (section 30)."""
from typing import Optional


class WazuhError(Exception):
    """Base error for all Wazuh integration failures."""

    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class WazuhAuthenticationError(WazuhError):
    """Credentials rejected by the Wazuh API."""


class WazuhConnectionError(WazuhError):
    """Wazuh API unreachable (network/DNS/timeout)."""


class WazuhResponseError(WazuhError):
    """Wazuh API returned an unexpected/malformed response."""
