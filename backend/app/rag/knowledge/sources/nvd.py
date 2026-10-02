"""NVD CVE adapter (NVD CVE API 2.0 JSON format).

Input: records shaped like the official NVD CVE API 2.0 response
(https://services.nvd.nist.gov/rest/json/cves/2.0). Each record:

    {
      "cve": {
        "id": "CVE-2024-12345",
        "descriptions": [{"lang": "en", "value": "..."}],
        "metrics": {"cvssMetricV31": [{"cvssData": {"baseScore": 9.8,
                     "baseSeverity": "CRITICAL", "vectorString": "..."},
                     "source": "...", "type": "Primary"}]},
        "references": [{"url": "https://..."}],
        "published": "2024-01-01T00:00:00.000",
        "lastModified": "2024-02-01T00:00:00.000",
        "containers": {"cna": {"affected": [{"product": "...", "vendor": "..."}]}}
      }
    }

Verified against NVD developer docs; every optional field is handled
gracefully and nothing is invented (spec Step 5). Records are accepted
either wrapped in {"cve": ...} or as the bare cve object.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.rag.knowledge.schemas import KnowledgeDocument
from app.rag.knowledge.sources.base import KnowledgeSource, KnowledgeSourceError

logger = logging.getLogger(__name__)

_DOCUMENT_TYPE = "cve_record"


def _english_description(cve: Dict[str, Any]) -> str:
    descriptions = cve.get("descriptions")
    if not isinstance(descriptions, list):
        return ""
    for entry in descriptions:
        if isinstance(entry, dict) and entry.get("lang") == "en" and isinstance(entry.get("value"), str):
            return entry["value"]
    # Fall back to the first string description if no English entry exists.
    for entry in descriptions:
        if isinstance(entry, dict) and isinstance(entry.get("value"), str):
            return entry["value"]
    return ""


def _primary_cvss(cve: Dict[str, Any]) -> Tuple[Optional[float], Optional[str], Optional[str]]:
    """Extract (base_score, severity, vector_string) from the primary metric.

    Preference order: cvssMetricV31 → V30 → V2. Only the metric entry marked
    type == 'Primary' (or the first entry as fallback) is used. Missing data
    yields None values — never defaults that look real.
    """
    metrics = cve.get("metrics")
    if not isinstance(metrics, dict):
        return None, None, None

    for key in ("cvssMetricV31", "cvssMetricV30", "cvssMetricV2"):
        entries = metrics.get(key)
        if not isinstance(entries, list) or not entries:
            continue
        primary = None
        for entry in entries:
            if isinstance(entry, dict) and entry.get("type") == "Primary":
                primary = entry
                break
        entry = primary if primary is not None else entries[0]
        if not isinstance(entry, dict):
            continue
        cvss_data = entry.get("cvssData")
        if not isinstance(cvss_data, dict):
            continue
        score = cvss_data.get("baseScore")
        score = float(score) if isinstance(score, (int, float)) else None
        severity = cvss_data.get("baseSeverity") or entry.get("baseSeverity")
        severity = str(severity).upper() if isinstance(severity, str) else None
        vector = cvss_data.get("vectorString")
        vector = str(vector) if isinstance(vector, str) else None
        return score, severity, vector
    return None, None, None


def _affected_products(cve: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Collect affected product entries from containers.cna / adp."""
    containers = cve.get("containers")
    if not isinstance(containers, dict):
        return []
    products: List[Dict[str, Any]] = []
    for container_key in ("cna", "adp"):
        container = containers.get(container_key)
        if not isinstance(container, dict):
            continue
        affected = container.get("affected")
        if not isinstance(affected, list):
            continue
        for entry in affected:
            if isinstance(entry, dict):
                products.append(
                    {
                        "vendor": entry.get("vendor") if isinstance(entry.get("vendor"), str) else None,
                        "product": entry.get("product") if isinstance(entry.get("product"), str) else None,
                        "versions": entry.get("versions")
                        if isinstance(entry.get("versions"), list)
                        else [],
                    }
                )
    return products


class NvdCveSource(KnowledgeSource):
    """Loads CVE records from a local NVD JSON export (API 2.0 shape).

    The file is expected at KNOWLEDGE_DATA_DIR/nvd_cves.json — produced
    out-of-band (e.g. via the NVD API) and kept out of Git. Accepts either
    the full API response body or a bare list of vulnerability records.
    """

    def __init__(self, data_path: Path) -> None:
        self._data_path = Path(data_path)

    @property
    def name(self) -> str:
        return "nvd_cve"

    def load_raw(self) -> List[Dict[str, Any]]:
        if not self._data_path.exists():
            raise KnowledgeSourceError(
                f"NVD data file not found at {self._data_path}. "
                "Export from the NVD CVE API 2.0 into KNOWLEDGE_DATA_DIR (kept out of Git)."
            )
        try:
            with self._data_path.open("r", encoding="utf-8") as fh:
                payload = json.load(fh)
        except (OSError, ValueError) as exc:
            raise KnowledgeSourceError(f"Cannot read NVD data file: {exc}") from exc

        vulnerabilities: List[Any] = []
        if isinstance(payload, dict) and isinstance(payload.get("vulnerabilities"), list):
            vulnerabilities = payload["vulnerabilities"]
        elif isinstance(payload, list):
            vulnerabilities = payload
        else:
            raise KnowledgeSourceError(
                "NVD data file is neither an API-2.0 response nor a record list"
            )

        records: List[Dict[str, Any]] = []
        for item in vulnerabilities:
            if isinstance(item, dict) and isinstance(item.get("cve"), dict):
                records.append(item["cve"])
            elif isinstance(item, dict):
                records.append(item)
        logger.info("nvd_file_loaded path=%s records=%d", self._data_path, len(records))
        return records

    def normalize_record(self, record: Dict[str, Any]) -> KnowledgeDocument:
        if not isinstance(record, dict):
            raise ValueError("record is not a dict")

        cve_id = record.get("id")
        if not isinstance(cve_id, str) or not cve_id.strip():
            raise ValueError("CVE record missing 'id'")
        cve_id = cve_id.strip().upper()
        if not cve_id.startswith("CVE-"):
            raise ValueError(f"invalid CVE id format: {cve_id}")

        description = _english_description(record)

        base_score, severity, vector = _primary_cvss(record)
        references = [
            {"url": r.get("url"), "source": r.get("source"), "tags": r.get("tags")}
            for r in record.get("references", [])
            if isinstance(r, dict) and isinstance(r.get("url"), str)
        ] if isinstance(record.get("references"), list) else []

        affected_products = _affected_products(record)
        metadata: Dict[str, Any] = {
            "cve_id": cve_id,
            "cvss_base_score": base_score,
            "cvss_severity": severity,
            "cvss_vector": vector,
            "affected_products": affected_products,
            "references": references,
            "vuln_status": record.get("vulnStatus")
            if isinstance(record.get("vulnStatus"), str)
            else None,
        }

        # Records without an English description stay usable: compose content
        # strictly from fields present in the record (no invention).
        if not description:
            parts = [f"{cve_id} vulnerability record."]
            if severity:
                parts.append(f"Severity: {severity}.")
            if base_score is not None:
                parts.append(f"CVSS base score: {base_score}.")
            product_names = [p["product"] for p in affected_products if p.get("product")]
            if product_names:
                parts.append("Affected products: " + ", ".join(product_names) + ".")
            description = " ".join(parts)

        title = f"{cve_id}: {severity or 'Unknown severity'}"
        return KnowledgeDocument(
            document_id=f"{self.name}:{_DOCUMENT_TYPE}:{cve_id}",
            source=self.name,
            document_type=_DOCUMENT_TYPE,
            title=title,
            content=description,
            source_url=f"https://nvd.nist.gov/vuln/detail/{cve_id}",
            source_identifier=cve_id,
            metadata=metadata,
            version=record.get("vulnStatus") if isinstance(record.get("vulnStatus"), str) else None,
            created=record.get("published") if isinstance(record.get("published"), str) else None,
            updated=record.get("lastModified") if isinstance(record.get("lastModified"), str) else None,
        )
