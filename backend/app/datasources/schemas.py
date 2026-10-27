"""Data source schemas and types.

Supports three distinct, strictly isolated security telemetry sources:
- demo: Curated demonstration scenarios based on Wazuh alert schemas.
- live_wazuh: Real alerts ingested from a configured Wazuh server or Wazuh Indexer.
- dataset_replay: Historical / public benchmark datasets (e.g. CIC-IDS, historical PCAP/Wazuh logs).
"""
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class DataSourceType(str, Enum):
    DEMO = "demo"
    LIVE_WAZUH = "live_wazuh"
    DATASET_REPLAY = "dataset_replay"


class SourceStatus(str, Enum):
    ACTIVE = "active"
    READY = "ready"
    UNCONFIGURED = "unconfigured"
    UNREACHABLE = "unreachable"
    ERROR = "error"


class SourceProvenance(BaseModel):
    """Traceable provenance attached to an alert record or API payload."""
    source_type: DataSourceType
    original_event_id: str
    event_timestamp: str
    ingestion_timestamp: Optional[str] = None
    dataset_version: Optional[str] = None
    scenario_id: Optional[str] = None
    connector_type: Optional[str] = None


class DataSourceInfo(BaseModel):
    id: DataSourceType
    label: str
    description: str
    status: SourceStatus
    is_live: bool
    is_default: bool
    record_count: int
    connector_type: Optional[str] = None
    endpoint: Optional[str] = None
    details: Dict[str, Any] = {}


class DataSourcesSummary(BaseModel):
    active_source: DataSourceType
    sources: List[DataSourceInfo]
