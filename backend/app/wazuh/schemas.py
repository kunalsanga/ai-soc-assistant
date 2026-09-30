"""Wazuh integration schemas.

The raw Wazuh JSON is never used as the application's internal contract.
Raw payloads are preserved in `raw_wazuh_data` for audit/debug purposes.
"""
from pydantic import BaseModel, ConfigDict, Field
from typing import Any, Dict, List, Optional
from datetime import datetime


class NormalizedSecurityAlert(BaseModel):
    """Internal, source-agnostic representation of a security alert.

    All fields are optional-safe: Wazuh alerts rarely contain every field,
    and normalization must handle missing values without failing.
    """
    model_config = ConfigDict(from_attributes=True)

    id: Optional[int] = None
    external_alert_id: str
    timestamp: Optional[str] = None
    severity: int = Field(default=0, ge=0, le=15)  # Wazuh levels are 0-15
    event_type: Optional[str] = None
    rule_id: Optional[str] = None
    rule_description: Optional[str] = None
    agent_id: Optional[str] = None
    agent_name: Optional[str] = None
    agent_os: Optional[str] = None
    source_ip: Optional[str] = None
    destination_ip: Optional[str] = None
    source_port: Optional[int] = None
    destination_port: Optional[int] = None
    username: Optional[str] = None
    process: Optional[str] = None
    file_path: Optional[str] = None
    location: Optional[str] = None
    mitre_tactics: List[str] = Field(default_factory=list)
    mitre_techniques: List[str] = Field(default_factory=list)
    raw_event: Optional[Dict[str, Any]] = None
    raw_wazuh_data: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    is_mock: bool = False


class SyncResult(BaseModel):
    """Outcome of an alert-sync operation from Wazuh into the local DB."""
    status: str = "ok"
    client_mode: str  # "mock" | "real"
    fetched: int
    created: int
    duplicates_skipped: int
    external_alert_ids: List[str] = Field(default_factory=list)
