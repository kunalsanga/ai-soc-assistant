"""Phase 3 pipeline composition.

    NormalizedSecurityAlert
        ↓ preprocess_alert()      (cleaning/canonicalization)
        ↓ ContextExtractor        (structured SecurityContext)
        ↓ RetrievalQueryBuilder   (categorized RetrievalQuerySet)

All stages are pure and synchronous; the pipeline adds only latency
instrumentation (spec section 29) and never touches the database or network.
Future phases consume `SecurityContext` and `RetrievalQuerySet` — the
boundary deliberately stops here.
"""
from __future__ import annotations

import logging
import time
from typing import TYPE_CHECKING

from app.security.context import ContextExtractor
from app.security.preprocessing import preprocess_alert
from app.security.retrieval_queries import RetrievalQueryBuilder
from app.security.schemas import (
    PreprocessedAlert,
    RetrievalQuerySet,
    SecurityContext,
)

if TYPE_CHECKING:  # runtime import would create a cycle via app.wazuh.service
    from app.wazuh.schemas import NormalizedSecurityAlert

logger = logging.getLogger(__name__)


class SecurityContextPipeline:
    """Compose preprocessing → context extraction → query construction."""

    def __init__(
        self,
        extractor: ContextExtractor | None = None,
        query_builder: RetrievalQueryBuilder | None = None,
    ) -> None:
        self._extractor = extractor or ContextExtractor()
        self._query_builder = query_builder or RetrievalQueryBuilder()

    def run(self, alert: NormalizedSecurityAlert) -> RetrievalQuerySet:
        """Run the full Phase 3 chain for one normalized alert."""
        started = time.perf_counter()

        preprocessed = self.preprocess(alert)
        context = self.extract_context(preprocessed)
        queries = self.build_queries(context)

        latency_ms = (time.perf_counter() - started) * 1000
        logger.info(
            "security_context_pipeline_done alert_id=%s queries=%d latency_ms=%.1f",
            context.alert_id,
            len(queries.all_queries()),
            latency_ms,
        )
        return queries

    # --- individual stages (public for granular testing/orchestration) -----

    def preprocess(self, alert: NormalizedSecurityAlert) -> PreprocessedAlert:
        return preprocess_alert(alert)

    def extract_context(self, preprocessed: PreprocessedAlert) -> SecurityContext:
        return self._extractor.extract(preprocessed)

    def build_queries(self, context: SecurityContext) -> RetrievalQuerySet:
        return self._query_builder.build(context)
