"""Alert service: the glue between Wazuh transport and the local database.

Flow:
    WazuhClient.get_alerts() → normalize_wazuh_alert() → dedupe → persist
    into the existing `alerts` table (async SQLAlchemy).

Dedupe is idempotent on `external_alert_id`, matching the existing unique
constraint. Errors surface as explicit WazuhError types (never generic 500s).
"""
from __future__ import annotations

import logging
import time
from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models.alert import Alert
from app.security.context import ContextExtractor
from app.security.normalization import normalize_wazuh_alert
from app.security.pipeline import SecurityContextPipeline
from app.security.preprocessing import preprocess_alert
from app.security.retrieval_queries import RetrievalQueryBuilder
from app.security.schemas import RetrievalQuerySet, SecurityContext
from app.wazuh.client import BaseWazuhClient, get_wazuh_client
from app.wazuh.exceptions import WazuhError
from app.wazuh.schemas import NormalizedSecurityAlert, SyncResult

logger = logging.getLogger(__name__)


def _normalized_alert_to_db_fields(alert: NormalizedSecurityAlert) -> dict:
    """Map a normalized alert onto the EXISTING `alerts` table columns.

    The existing table is intentionally preserved; richer normalized fields
    (ports, MITRE, process, etc.) live inside raw_data as structured JSON for
    now, so no schema change is forced on teammates' foundation.
    """
    return {
        "external_alert_id": alert.external_alert_id,
        "timestamp": alert.timestamp,
        "severity": alert.severity,
        "rule_id": alert.rule_id,
        "rule_description": alert.rule_description,
        "agent_name": alert.agent_name,
        "source_ip": alert.source_ip,
        "destination_ip": alert.destination_ip,
        "username": alert.username,
        "raw_data": alert.raw_wazuh_data,  # typed as Any dict; converted below
        "status": "open",
    }


class AlertService:
    def __init__(
        self,
        client: BaseWazuhClient | None = None,
        context_pipeline: SecurityContextPipeline | None = None,
    ):
        self._client = client
        self._context_pipeline = context_pipeline or SecurityContextPipeline()

    async def _get_client(self) -> BaseWazuhClient:
        if self._client is None:
            self._client = get_wazuh_client()
        return self._client

    async def sync_alerts(
        self,
        db: AsyncSession,
        limit: int = 25,
    ) -> SyncResult:
        """Fetch → normalize → dedupe → persist. Idempotent; safe to re-run."""
        started = time.perf_counter()
        client = await self._get_client()

        try:
            raw_alerts = await client.get_alerts(limit=limit)
        except WazuhError as exc:
            logger.error("wazuh_sync_failed error=%s", exc.message)
            raise
        except Exception as exc:  # noqa: BLE001
            logger.error("wazuh_sync_unexpected_error error=%s", exc)
            raise WazuhError(f"Unexpected Wazuh client failure: {exc}") from exc

        fetched = len(raw_alerts)
        created = 0
        duplicates_skipped = 0
        external_ids: List[str] = []

        for raw in raw_alerts:
            try:
                normalized = normalize_wazuh_alert(raw)
            except ValueError as exc:
                # Malformed alert: log and continue rather than failing the
                # entire batch — one bad payload must not block ingestion.
                logger.warning("alert_normalization_skipped error=%s", exc)
                duplicates_skipped += 0
                continue

            # Dedupe on external_alert_id (existing unique constraint).
            result = await db.execute(
                select(Alert).where(
                    Alert.external_alert_id == normalized.external_alert_id
                )
            )
            existing = result.scalar_one_or_none()
            if existing is not None:
                duplicates_skipped += 1
                continue

            fields = _normalized_alert_to_db_fields(normalized)
            raw_data = fields.pop("raw_data")
            if not isinstance(raw_data, str):
                import json
                raw_data = json.dumps(raw_data, default=str)

            db.add(Alert(**fields, raw_data=raw_data))
            created += 1
            external_ids.append(normalized.external_alert_id)

        await db.commit()
        latency_ms = (time.perf_counter() - started) * 1000
        logger.info(
            "alerts_synced client=%s fetched=%d created=%d duplicates=%d latency_ms=%.1f",
            client.mode,
            fetched,
            created,
            duplicates_skipped,
            latency_ms,
        )
        return SyncResult(
            client_mode=client.mode,
            fetched=fetched,
            created=created,
            duplicates_skipped=duplicates_skipped,
            external_alert_ids=external_ids,
        )

    async def get_normalized_alert(
        self, db: AsyncSession, alert_id: int
    ) -> NormalizedSecurityAlert | None:
        """Load a persisted alert and re-express it in normalized form."""
        result = await db.execute(select(Alert).where(Alert.id == alert_id))
        row = result.scalar_one_or_none()
        if row is None:
            return None

        raw = None
        if row.raw_data:
            import json
            try:
                raw = json.loads(row.raw_data)
            except ValueError:
                raw = {"legacy_raw_data": row.raw_data}

        normalized = normalize_wazuh_alert(
            raw if isinstance(raw, dict) else {}
        ) if raw else None
        if normalized is None:
            # Legacy row without usable raw data: build minimal normalized view.
            normalized = NormalizedSecurityAlert(
                external_alert_id=row.external_alert_id,
                timestamp=row.timestamp,
                severity=row.severity or 0,
                rule_id=row.rule_id,
                rule_description=row.rule_description,
                agent_name=row.agent_name,
                source_ip=row.source_ip,
                destination_ip=row.destination_ip,
                username=row.username,
            )
        normalized.id = row.id
        return normalized

    def get_security_context(
        self, alert: NormalizedSecurityAlert
    ) -> tuple[SecurityContext, RetrievalQuerySet]:
        """Run the Phase 3 pipeline: preprocess → context → retrieval queries.

        Pure in-memory composition (no DB writes, no network). Kept off the
        API surface for now; later phases consume these objects directly.
        """
        preprocessed = preprocess_alert(alert)
        context = self._context_pipeline.extract_context(preprocessed)
        queries = self._context_pipeline.build_queries(context)
        return context, queries


# Convenience re-export for orchestrators that only need the extractor.
__all__ = ["AlertService", "ContextExtractor", "RetrievalQueryBuilder"]
