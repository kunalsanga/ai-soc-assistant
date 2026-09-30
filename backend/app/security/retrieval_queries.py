"""RetrievalQueryBuilder: deterministic retrieval queries from a SecurityContext.

Produces categorized queries (mitre / nvd / security) for the FUTURE RAG
layer. Nothing is retrieved here and no external API is called (spec Step 7).

Query construction rules:
- MITRE queries exist only when the alert carries technique IDs (from the
  alert itself, never invented).
- NVD/CVE queries exist only when the context contains CVE identifiers or
  product-ish keywords extracted from the alert; never fabricated.
- Security queries always exist, built from the event type / rule description
  keywords, so the future retriever always has a general fallback.
- Same input → same output, always.
"""
from __future__ import annotations

import logging
import re
from typing import List, Optional

from app.security.schemas import (
    RetrievalQuery,
    RetrievalQuerySet,
    SecurityContext,
)

logger = logging.getLogger(__name__)

_CVE_RE = re.compile(r"\bCVE-\d{4}-\d{4,7}\b", re.IGNORECASE)

_MAX_QUERIES_PER_CATEGORY = 5


def _dedupe(items: List[str]) -> List[str]:
    return list(dict.fromkeys(item for item in items if item))


def _find_cves(text: Optional[str]) -> List[str]:
    if not text:
        return []
    return list(dict.fromkeys(m.group(0).upper() for m in _CVE_RE.finditer(text)))


class RetrievalQueryBuilder:
    """Builds a RetrievalQuerySet from a SecurityContext (pure, deterministic)."""

    def build(self, context: SecurityContext) -> RetrievalQuerySet:
        query_set = RetrievalQuerySet(alert_id=context.alert_id)

        # --- 1. MITRE ATT&CK queries ------------------------------------
        for technique in context.mitre_techniques[:_MAX_QUERIES_PER_CATEGORY]:
            query_set.mitre_queries.append(
                RetrievalQuery(
                    query_id=f"{context.alert_id}:mitre:{technique}",
                    category="mitre",
                    text=f"MITRE ATT&CK technique {technique}",
                    source_hint="MITRE",
                    metadata={"technique_id": technique},
                )
            )

        # --- 2. NVD / CVE queries ----------------------------------------
        cves = _find_cves(context.rule_description)
        # CVEs explicitly present in the alert text; never fabricated.
        for cve in cves[:_MAX_QUERIES_PER_CATEGORY]:
            query_set.nvd_queries.append(
                RetrievalQuery(
                    query_id=f"{context.alert_id}:nvd:{cve}",
                    category="nvd",
                    text=f"{cve} vulnerability details",
                    source_hint="NVD",
                    metadata={"cve_id": cve},
                )
            )

        # --- 3. General security knowledge queries ------------------------
        security_terms: List[str] = []
        if context.event_type:
            security_terms.append(context.event_type.replace("_", " ").strip())
        security_terms.extend(context.keywords[:4])
        security_terms = _dedupe(security_terms)[:_MAX_QUERIES_PER_CATEGORY]

        if security_terms:
            text = " ".join(security_terms)
            query_set.security_queries.append(
                RetrievalQuery(
                    query_id=f"{context.alert_id}:security:general",
                    category="security",
                    text=text,
                    source_hint=None,
                    metadata={
                        "event_type": context.event_type,
                        "rule_id": context.rule_id,
                        "severity": context.severity,
                    },
                )
            )

        logger.info(
            "retrieval_queries_built alert_id=%s mitre=%d nvd=%d security=%d",
            query_set.alert_id,
            len(query_set.mitre_queries),
            len(query_set.nvd_queries),
            len(query_set.security_queries),
        )
        return query_set
