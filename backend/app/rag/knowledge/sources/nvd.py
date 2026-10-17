"""NVD/CVE adapter (NVD API 2.0 JSON format).

Input: JSON saved from https://services.nvd.nist.gov/rest/json/cves/2.0
(the fetch script scripts/fetch_nvd.py keeps a small, reproducible corpus
in KNOWLEDGE_DATA_DIR). Each CVE record looks like:

    {
      "vulnerabilities": [
        {
          "cve": {
            "id": "CVE-2024-6387",
            "sourceIdentifier": "...",
            "published": "2024-07-01T...",
            "lastModified": "...",
            "vulnStatus": "Analyzed",
            "descriptions": [{"lang": "en", "value": "..."}],
            "metrics": {"cvssMetricV31": [{"cvssData": {"baseScore": 8.1, ...}}]},
            "references": [{"url": "...", "source": "..."}],
            "weaknesses": [...]
          }
        }
      ]
    }

Field access is defensive: anything missing is simply absent from the
document (never invented). REJECTED/unknown-status CVEs are skipped.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.rag.knowledge.schemas import KnowledgeDocument
from app.rag.knowledge.sources.base import KnowledgeSource, KnowledgeSourceError

logger = logging.getLogger(__name__)

_DOCUMENT_TYPE = "cve_record"
_ACCEPTED_STATUSES = {"analyzed", "modified"}
# IDs of CVEs that no longer carry actionable content.
_SKIP_STATUSES = {"rejected", "awaiting_analysis"}


def _english_description(cve: Dict[str, Any]) -> str:
    for desc in cve.get("descriptions", []) or []:
        if isinstance(desc, dict) and desc.get("lang") == "en" and desc.get("value"):
            return str(desc["value"])
    return ""


def _cvss(cve: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Highest-quality CVSS score for the record (Primary preferred over Secondary).

    Returns flat keys: base_score / base_severity / vector / version.
    """
    metrics = cve.get("metrics", {}) or {}
    for key in ("cvssMetricV40", "cvssMetricV31", "cvssMetricV30", "cvssMetricV2"):
        entries = [e for e in (metrics.get(key) or []) if isinstance(e, dict)]
        # Official NVD records mark the authoritative score "Primary";
        # prefer it when both Primary and Secondary scores are present.
        entries.sort(key=lambda e: e.get("type") != "Primary")
        for entry in entries:
            data = entry.get("cvssData") or {}
            if isinstance(data.get("baseScore"), (int, float)):
                return {
                    "base_score": data.get("baseScore"),
                    "base_severity": data.get("baseSeverity"),
                    "vector": data.get("vectorString"),
                    "version": data.get("version") or key.replace("cvssMetric", "v"),
                }
    return None


def _affected_products(cve: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Affected products from the CNA container, when published."""
    containers = cve.get("containers", {}) or {}
    cna = containers.get("cna", {}) or {}
    products: List[Dict[str, Any]] = []
    for entry in cna.get("affected", []) or []:
        if not isinstance(entry, dict):
            continue
        item = {
            key: entry.get(key)
            for key in ("vendor", "product", "platform", "packageSlug")
            if entry.get(key)
        }
        if item:
            products.append(item)
    return products


class NvdCveSource(KnowledgeSource):
    """Loads CVE records from a local NVD API 2.0 JSON export."""

    def __init__(self, json_path: Path) -> None:
        self._path = Path(json_path)

    @property
    def name(self) -> str:
        return "nvd_cve"

    def load_raw(self) -> List[Dict[str, Any]]:
        if not self._path.exists():
            raise KnowledgeSourceError(
                f"NVD export not found at {self._path}. Run scripts/fetch_nvd.py "
                "to build a small reproducible corpus first."
            )
        try:
            payload = json.loads(self._path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            raise KnowledgeSourceError(f"Cannot read NVD export: {exc}") from exc

        if isinstance(payload, list):
            # Bare list export: items are records (wrapped or bare CVE dicts).
            vulnerabilities = payload
        elif isinstance(payload, dict):
            vulnerabilities = payload.get("vulnerabilities")
        else:
            vulnerabilities = None
        if not isinstance(vulnerabilities, list):
            raise KnowledgeSourceError("NVD export has no 'vulnerabilities' list")
        cves: List[Dict[str, Any]] = []
        for item in vulnerabilities:
            if not isinstance(item, dict):
                continue
            inner = item.get("cve")
            if isinstance(inner, dict):
                cves.append(inner)
            elif str(item.get("id", "")).startswith("CVE-"):
                cves.append(item)  # bare record placed directly in the list
        logger.info("nvd_export_loaded path=%s cves=%d", self._path, len(cves))
        return cves

    def normalize_record(self, record: Dict[str, Any]) -> KnowledgeDocument:
        if not isinstance(record, dict) or not str(record.get("id", "")).startswith("CVE-"):
            raise ValueError("record is not an NVD CVE object")

        cve_id = str(record["id"]).strip().upper()

        status = str(record.get("vulnStatus", "")).strip().lower()
        if status in _SKIP_STATUSES:
            raise ValueError(f"{cve_id} skipped (vulnStatus={status or 'unknown'})")

        # Descriptions are optional in the export; anything absent is simply
        # not composed into the content — nothing is invented.
        description = _english_description(record)

        cvss = _cvss(record)
        base_score = cvss.get("base_score") if cvss else None
        base_severity = cvss.get("base_severity") if cvss else None
        vector = cvss.get("vector") if cvss else None

        references = [
            {"url": r.get("url"), "source": r.get("source"), "tags": r.get("tags") or []}
            for r in record.get("references", []) or []
            if isinstance(r, dict) and r.get("url")
        ]
        cwe_ids = [
            w["cwe"]["id"]
            for w in record.get("weaknesses", []) or []
            if isinstance(w, dict) and isinstance(w.get("cwe"), dict) and w["cwe"].get("id")
        ]
        affected_products = _affected_products(record)

        # Contextual composition: strictly from fields present in the record.
        content = f"{cve_id} vulnerability record."
        if base_score is not None:
            content += f" CVSS {base_score} {base_severity} ({vector})."
        if description:
            content += f" {description}"

        if base_severity:
            title = f"{cve_id} ({base_severity})"
        else:
            title = f"{cve_id} (Unknown severity)"

        metadata: Dict[str, Any] = {
            "cve_id": cve_id,
            "cvss_base_score": base_score,
            "cvss_severity": base_severity,
            "cvss_vector": vector,
            "affected_products": affected_products,
            "cwe_ids": sorted(set(cwe_ids)),
            "source_identifier_nvd": record.get("sourceIdentifier"),
            "vuln_status": record.get("vulnStatus"),
            "references": references[:10],
        }

        published = record.get("published")
        modified = record.get("lastModified")

        return KnowledgeDocument(
            document_id=f"{self.name}:{_DOCUMENT_TYPE}:{cve_id}",
            source=self.name,
            document_type=_DOCUMENT_TYPE,
            title=title,
            content=content,
            source_url=f"https://nvd.nist.gov/vuln/detail/{cve_id}",
            source_identifier=cve_id,
            metadata=metadata,
            version=None,
            created=published if isinstance(published, str) else None,
            updated=modified if isinstance(modified, str) else None,
        )
