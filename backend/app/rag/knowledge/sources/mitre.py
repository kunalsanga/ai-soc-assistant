"""MITRE ATT&CK adapter (STIX bundle format).

Input: official `enterprise-attack.json` STIX bundle from
mitre-attack/attack-stix-data. Techniques are `attack-pattern` STIX objects:

    {
      "type": "attack-pattern",
      "id": "attack-pattern--...",
      "name": "Brute Force",
      "description": "...",
      "external_references": [{"external_id": "T1110", "url": "https://attack.mitre.org/techniques/T1110/", ...}],
      "x_mitre_platforms": ["Linux", "Windows", ...],
      "kill_chain_phases": [{"kill_chain_name": "mitre-attack", "phase_name": "credential-access"}],
      "x_mitre_is_subtechnique": true,
      "x_mitre_detection": "...",
      "x_mitre_version": "1.1",
      "created": "2017-05-31T21:30:41.733Z",
      "modified": "2020-03-29T22:34:11.123Z",
      ...
    }

Field names verified against the official attack-stix-data USAGE docs; the
adapter is tolerant of objects missing any optional field and never invents
values. Revoked/deprecated techniques are still indexed (flagged in
metadata) so lookups by technique ID keep working.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.rag.knowledge.schemas import KnowledgeDocument
from app.rag.knowledge.sources.base import KnowledgeSource, KnowledgeSourceError

logger = logging.getLogger(__name__)

_DOCUMENT_TYPE = "technique"


def _first_external_reference(external_refs: Any) -> Optional[Dict[str, Any]]:
    """Pick the ATT&CK external reference carrying the technique id."""
    if not isinstance(external_refs, list):
        return None
    for ref in external_refs:
        if isinstance(ref, dict) and ref.get("external_id"):
            return ref
    return None


def _tactics(kill_chain_phases: Any) -> List[str]:
    if not isinstance(kill_chain_phases, list):
        return []
    return [
        phase.get("phase_name")
        for phase in kill_chain_phases
        if isinstance(phase, dict)
        and phase.get("kill_chain_name") == "mitre-attack"
        and phase.get("phase_name")
    ]


class MitreAttackSource(KnowledgeSource):
    """Loads ATT&CK techniques from a local STIX bundle file.

    The bundle is expected at KNOWLEDGE_DATA_DIR/enterprise-attack.json
    (downloaded out-of-band by the operator; data lives outside Git).
    """

    def __init__(self, bundle_path: Path) -> None:
        self._bundle_path = Path(bundle_path)

    @property
    def name(self) -> str:
        return "mitre_attack"

    def load_raw(self) -> List[Dict[str, Any]]:
        if not self._bundle_path.exists():
            raise KnowledgeSourceError(
                f"MITRE STIX bundle not found at {self._bundle_path}. "
                "Download enterprise-attack.json from mitre-attack/attack-stix-data "
                "into KNOWLEDGE_DATA_DIR (kept out of Git)."
            )
        try:
            with self._bundle_path.open("r", encoding="utf-8") as fh:
                bundle = json.load(fh)
        except (OSError, ValueError) as exc:
            raise KnowledgeSourceError(f"Cannot read MITRE STIX bundle: {exc}") from exc

        objects = bundle.get("objects") if isinstance(bundle, dict) else None
        if not isinstance(objects, list):
            raise KnowledgeSourceError(
                "MITRE STIX bundle has no 'objects' list — is this a STIX bundle?"
            )
        techniques = [
            obj for obj in objects
            if isinstance(obj, dict) and obj.get("type") == "attack-pattern"
        ]
        logger.info(
            "mitre_bundle_loaded path=%s attack_patterns=%d", self._bundle_path, len(techniques)
        )
        return techniques

    def normalize_record(self, record: Dict[str, Any]) -> KnowledgeDocument:
        if not isinstance(record, dict) or record.get("type") != "attack-pattern":
            raise ValueError("record is not a STIX attack-pattern object")

        name = record.get("name")
        if not isinstance(name, str) or not name.strip():
            raise ValueError("attack-pattern missing 'name'")
        name = name.strip()

        ext_ref = _first_external_reference(record.get("external_references"))
        technique_id = (ext_ref or {}).get("external_id")
        if not isinstance(technique_id, str) or not technique_id.strip():
            raise ValueError(f"attack-pattern '{name}' has no external_id (technique id)")
        technique_id = technique_id.strip()

        description = record.get("description")
        content = description if isinstance(description, str) and description.strip() else ""

        detection = record.get("x_mitre_detection")
        detection_text = detection if isinstance(detection, str) and detection.strip() else None

        tactics = _tactics(record.get("kill_chain_phases"))
        platforms = (
            [p for p in record.get("x_mitre_platforms", []) if isinstance(p, str)]
            if isinstance(record.get("x_mitre_platforms"), list)
            else []
        )

        # Records without prose descriptions stay usable: compose content
        # strictly from fields present in the record (no invention).
        if not content and detection_text:
            content = detection_text
        if not content:
            parts = [f"{name} (ATT&CK technique {technique_id})"]
            if tactics:
                parts.append("Tactics: " + ", ".join(tactics))
            if platforms:
                parts.append("Platforms: " + ", ".join(platforms))
            content = ". ".join(parts) + "."

        stix_id = record.get("id") if isinstance(record.get("id"), str) else None
        url = ext_ref.get("url") if isinstance(ext_ref, dict) else None

        # Structured metadata: nothing flattened away (spec Step 4).
        metadata: Dict[str, Any] = {
            "technique_id": technique_id,
            "technique_name": name,
            "tactics": tactics,
            "platforms": platforms,
            "is_sub_technique": bool(record.get("x_mitre_is_subtechnique", False)),
            "detection": detection_text,
            "references": [
                {"url": r.get("url"), "description": r.get("description"), "source_name": r.get("source_name")}
                for r in record.get("external_references", [])
                if isinstance(r, dict)
            ],
            "stix_id": stix_id,
            "revoked": bool(record.get("revoked", False)),
            "deprecated": bool(record.get("x_mitre_deprecated", False)),
        }

        return KnowledgeDocument(
            document_id=f"{self.name}:{_DOCUMENT_TYPE}:{technique_id}",
            source=self.name,
            document_type=_DOCUMENT_TYPE,
            title=name,
            content=content,
            source_url=url,
            source_identifier=technique_id,
            metadata=metadata,
            version=(
                record.get("x_mitre_version")
                if isinstance(record.get("x_mitre_version"), str)
                else None
            ),
            created=record.get("created") if isinstance(record.get("created"), str) else None,
            updated=record.get("modified") if isinstance(record.get("modified"), str) else None,
        )
