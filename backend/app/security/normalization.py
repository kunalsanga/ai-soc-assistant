"""Deterministic normalization of raw Wazuh alerts into SecurityAlert models.

Rules:
- Raw Wazuh JSON is NEVER the internal contract; it is preserved verbatim in
  `raw_wazuh_data` (and `raw_event`) for audit/debug purposes.
- Missing fields are handled safely — normalization never assumes a field
  exists and never raises on partial alerts.
- No network calls, no randomness: deterministic and fully unit-testable.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from app.wazuh.schemas import NormalizedSecurityAlert

logger = logging.getLogger(__name__)

# Wazuh severity (rule.level) is 0-15; clamp anything outside that range.
_MIN_SEVERITY = 0
_MAX_SEVERITY = 15


def _first(*candidates: Any) -> Optional[Any]:
    """Return the first non-None candidate."""
    for candidate in candidates:
        if candidate is not None:
            return candidate
    return None


def _as_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        return value or None
    return str(value)


def _as_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _as_str_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value] if value else []
    if isinstance(value, (list, tuple)):
        return [str(v) for v in value if v is not None]
    return []


def _extract_mitre(raw: Dict[str, Any]) -> tuple[List[str], List[str]]:
    """Extract MITRE tactics/techniques from the known Wazuh placements."""
    rule = raw.get("rule") if isinstance(raw.get("rule"), dict) else {}

    techniques: List[str] = []
    tactics: List[str] = []

    mitre = rule.get("mitre") or {}
    if isinstance(mitre, dict):
        techniques.extend(_as_str_list(mitre.get("id")))
        tactics.extend(_as_str_list(mitre.get("tactic")))
    elif isinstance(mitre, list):
        for entry in mitre:
            if not isinstance(entry, dict):
                continue
            techniques.extend(_as_str_list(entry.get("id")))
            tactics.extend(_as_str_list(entry.get("tactic")))

    # Some rule sets also expose technique ids under rule.mitre_ids or as
    # top-level `mitre_techniques`; accept them as secondary sources.
    techniques.extend(_as_str_list(rule.get("mitre_ids")))
    techniques.extend(_as_str_list(raw.get("mitre_techniques")))
    tactics.extend(_as_str_list(raw.get("mitre_tactics")))

    # Deduplicate, preserving order.
    techniques = list(dict.fromkeys(techniques))
    tactics = list(dict.fromkeys(t.lower() for t in tactics))
    return techniques, tactics


def _normalize_timestamp(value: Any) -> Optional[str]:
    """Keep timestamps as ISO-8601 strings; tolerate Wazuh's +0000 suffix."""
    ts = _as_str(value)
    if ts is None:
        return None
    return ts.replace("+0000", "+00:00")


def normalize_wazuh_alert(raw: Dict[str, Any]) -> NormalizedSecurityAlert:
    """Convert one raw Wazuh alert dict into a NormalizedSecurityAlert.

    Never raises on missing fields; only a completely non-dict input or a
    missing alert id is rejected (the id is the only required value).
    """
    if not isinstance(raw, dict):
        raise ValueError("Raw Wazuh alert must be a dict")

    external_id = _as_str(
        _first(raw.get("id"), raw.get("alert_id"), raw.get("external_alert_id"))
    )
    if not external_id:
        raise ValueError("Raw Wazuh alert is missing its 'id' field")

    rule = raw.get("rule") if isinstance(raw.get("rule"), dict) else {}
    agent = raw.get("agent") if isinstance(raw.get("agent"), dict) else {}
    data = raw.get("data") if isinstance(raw.get("data"), dict) else {}
    agent_os = agent.get("os") if isinstance(agent.get("os"), dict) else {}

    # --- timestamp -----------------------------------------------------
    timestamp = _normalize_timestamp(
        _first(raw.get("timestamp"), raw.get("@timestamp"), raw.get("time"))
    )

    # --- severity (Wazuh rule.level, 0-15) ------------------------------
    severity = _as_int(rule.get("level"))
    if severity is None:
        severity = _as_int(raw.get("severity"))
    if severity is None:
        severity = 0
    severity = max(_MIN_SEVERITY, min(_MAX_SEVERITY, severity))

    # --- event type ------------------------------------------------------
    groups = _as_str_list(rule.get("groups"))
    event_type = _first(_as_str(raw.get("event_type")), groups[0] if groups else None)

    # --- entities --------------------------------------------------------
    src_ip = _as_str(_first(data.get("srcip"), raw.get("source_ip"), data.get("src_ip")))
    dst_ip = _as_str(_first(data.get("dstip"), raw.get("destination_ip"), data.get("dst_ip")))
    src_port = _as_int(_first(data.get("srcport"), data.get("src_port")))
    dst_port = _as_int(_first(data.get("dstport"), data.get("dst_port")))
    username = _as_str(_first(data.get("dstuser"), data.get("srcuser"), raw.get("username")))
    process = _as_str(_first(data.get("process"), data.get("process_name")))
    file_path = _as_str(_first(data.get("file"), data.get("path")))
    location = _as_str(_first(raw.get("location"), data.get("location")))

    techniques, tactics = _extract_mitre(raw)

    alert = NormalizedSecurityAlert(
        external_alert_id=external_id,
        timestamp=timestamp,
        severity=severity,
        event_type=event_type,
        rule_id=_as_str(rule.get("id")),
        rule_description=_as_str(
            _first(rule.get("description"), raw.get("description"))
        ),
        agent_id=_as_str(agent.get("id")),
        agent_name=_as_str(agent.get("name")),
        agent_os=_as_str(
            _first(agent_os.get("name"), agent_os.get("full"))
        ),
        source_ip=src_ip,
        destination_ip=dst_ip,
        source_port=src_port,
        destination_port=dst_port,
        username=username,
        process=process,
        file_path=file_path,
        location=location,
        mitre_tactics=tactics,
        mitre_techniques=techniques,
        raw_event=dict(raw),
        raw_wazuh_data=dict(raw),
    )
    logger.info(
        "alert_normalized external_alert_id=%s severity=%d event_type=%s techniques=%s",
        alert.external_alert_id,
        alert.severity,
        alert.event_type,
        ",".join(alert.mitre_techniques) or "-",
    )
    return alert
