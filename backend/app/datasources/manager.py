"""Data source manager.

Coordinates data source isolation, queries, and health evaluation across:
1. `demo`: Curated demonstration alerts (default).
2. `live_wazuh`: Live Wazuh indexer or manager alerts.
3. `dataset_replay`: Replayed historical or benchmark datasets.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.selectable import Select

from app.core.config import settings
from app.datasources.schemas import (
    DataSourceInfo,
    DataSourcesSummary,
    DataSourceType,
    SourceStatus,
)
from app.db.models.alert import Alert

logger = logging.getLogger(__name__)


class DataSourceManager:
    """Manages data source status, query isolation, and stats."""

    @staticmethod
    def normalize_source(source: Optional[str]) -> DataSourceType:
        if not source:
            return DataSourceType(settings.DEFAULT_DATA_SOURCE)
        clean = source.strip().lower()
        if clean in ("demo", "synthetic", "mock"):
            return DataSourceType.DEMO
        if clean in ("live", "live_wazuh", "real", "wazuh"):
            return DataSourceType.LIVE_WAZUH
        if clean in ("replay", "dataset_replay", "historical", "cic_ids"):
            return DataSourceType.DATASET_REPLAY
        return DataSourceType.DEMO

    @staticmethod
    def filter_query(stmt: Select, source: DataSourceType) -> Select:
        """Apply strict SQL-level filtering for the specified data source.

        - demo: matches alerts where data_source == 'demo' or data_source IS NULL.
        - live_wazuh: strictly matches data_source == 'live_wazuh'.
        - dataset_replay: strictly matches data_source == 'dataset_replay'.
        """
        if source == DataSourceType.DEMO:
            return stmt.where(or_(Alert.data_source == "demo", Alert.data_source.is_(None)))
        elif source == DataSourceType.LIVE_WAZUH:
            return stmt.where(Alert.data_source == "live_wazuh")
        elif source == DataSourceType.DATASET_REPLAY:
            return stmt.where(Alert.data_source == "dataset_replay")
        return stmt

    @classmethod
    async def get_source_summary(cls, db: AsyncSession, active_source: Optional[DataSourceType] = None) -> DataSourcesSummary:
        """Return the status and record counts for all 3 data sources."""
        active = active_source or DataSourceType(settings.DEFAULT_DATA_SOURCE)

        # Count records in database per data source
        demo_count_stmt = select(func.count(Alert.id)).where(or_(Alert.data_source == "demo", Alert.data_source.is_(None)))
        live_count_stmt = select(func.count(Alert.id)).where(Alert.data_source == "live_wazuh")
        replay_count_stmt = select(func.count(Alert.id)).where(Alert.data_source == "dataset_replay")

        demo_count = (await db.execute(demo_count_stmt)).scalar_one()
        live_count = (await db.execute(live_count_stmt)).scalar_one()
        replay_count = (await db.execute(replay_count_stmt)).scalar_one()

        # Check live Wazuh configuration
        live_configured = False
        live_status = SourceStatus.UNCONFIGURED
        connector_type = settings.WAZUH_CONNECTOR_TYPE
        endpoint = ""

        if connector_type == "indexer":
            endpoint = settings.WAZUH_INDEXER_URL or ""
            live_configured = bool(endpoint and settings.WAZUH_INDEXER_USERNAME and settings.WAZUH_INDEXER_PASSWORD)
        else:
            endpoint = settings.WAZUH_BASE_URL or settings.WAZUH_API_URL or ""
            live_configured = bool(endpoint and settings.WAZUH_USERNAME and settings.WAZUH_PASSWORD)

        if not live_configured:
            live_status = SourceStatus.UNCONFIGURED
        elif settings.WAZUH_MODE.lower() == "real":
            live_status = SourceStatus.READY
        else:
            live_status = SourceStatus.UNCONFIGURED

        sources = [
            DataSourceInfo(
                id=DataSourceType.DEMO,
                label="Synthetic Demo Scenarios",
                description="Curated synthetic attack scenarios adhering to real Wazuh alert schemas. Benchmark and dashboard baseline.",
                status=SourceStatus.ACTIVE if active == DataSourceType.DEMO else SourceStatus.READY,
                is_live=False,
                is_default=True,
                record_count=demo_count,
                connector_type="demo_engine",
                endpoint="local_dataset",
                details={
                    "scenarios": 6,
                    "dataset_version": "v2",
                    "origin": "synthetic_demo",
                },
            ),
            DataSourceInfo(
                id=DataSourceType.LIVE_WAZUH,
                label="Live Wazuh Manager / Indexer",
                description="Real telemetry ingested from a configured Wazuh deployment via Wazuh Indexer OpenSearch or Manager API.",
                status=SourceStatus.ACTIVE if active == DataSourceType.LIVE_WAZUH else live_status,
                is_live=True,
                is_default=False,
                record_count=live_count,
                connector_type=connector_type,
                endpoint=endpoint if endpoint else "not configured",
                details={
                    "configured": live_configured,
                    "mode": settings.WAZUH_MODE,
                    "index_pattern": settings.WAZUH_INDEX_PATTERN if connector_type == "indexer" else None,
                    "verify_ssl": settings.WAZUH_VERIFY_SSL,
                },
            ),
            DataSourceInfo(
                id=DataSourceType.DATASET_REPLAY,
                label="Historical Dataset Replay",
                description="Replayed public benchmark datasets (e.g. CIC-IDS2017, historical PCAPs). Labeled explicitly as replayed.",
                status=SourceStatus.ACTIVE if active == DataSourceType.DATASET_REPLAY else SourceStatus.READY,
                is_live=False,
                is_default=False,
                record_count=replay_count,
                connector_type="dataset_replay_adapter",
                endpoint="offline_corpus",
                details={
                    "supported_formats": ["cic_ids_2017", "wazuh_alerts_json", "zeek_json"],
                },
            ),
        ]

        return DataSourcesSummary(
            active_source=active,
            sources=sources,
        )
