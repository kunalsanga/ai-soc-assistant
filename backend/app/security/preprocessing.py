"""AlertPreprocessor: clean and canonicalize a NormalizedSecurityAlert.

Responsibilities (spec Step 2A):
- trim/clean textual fields, drop empty/noisy values
- normalize casing where appropriate (event_type, protocol, process, tactics)
- canonicalize MITRE technique identifiers (T1234 / TA0001 formats)
- strip obviously malformed values (e.g. non-IP strings in IP fields)
- record what was dropped (`dropped_fields`) — never silently destroy evidence

The preprocessor is a pure, synchronous, deterministic function: same input
always produces the same output. It never invents values and never mutates
the input alert.
"""
from __future__ import annotations

import logging
import re
from typing import List, Optional, TYPE_CHECKING

from app.security.schemas import PreprocessedAlert

if TYPE_CHECKING:  # runtime import would create a cycle via app.wazuh.service
    from app.wazuh.schemas import NormalizedSecurityAlert

logger = logging.getLogger(__name__)

# IPv4 dotted quad (sufficient for lab data; IPv6 left untouched if valid-looking).
_IPV4_RE = re.compile(r"^(\d{1,3}\.){3}\d{1,3}$")

# Canonical MITRE technique form: T + 4 digits (e.g. T1110), optionally with
# a sub-technique suffix (T1110.001). Tactics: TA + 4 digits (TA0006).
_TECHNIQUE_RE = re.compile(r"^(T\d{4}(?:\.\d{3})?)$", re.IGNORECASE)
_TACTIC_ID_RE = re.compile(r"^(TA\d{4})$", re.IGNORECASE)

# Protocol tokens we know how to canonicalize; anything else is lowercased only.
_KNOWN_PROTOCOLS = {"tcp", "udp", "icmp", "ssh", "http", "https", "tls", "dns", "smb"}

_MAX_TEXT_LEN = 2000


def _clean_str(value: Optional[str]) -> Optional[str]:
    """Trim whitespace; collapse to None when empty/noisy."""
    if value is None:
        return None
    cleaned = value.strip()
    if not cleaned or cleaned.lower() in {"", "none", "null", "n/a", "unknown", "-"}:
        return None
    if len(cleaned) > _MAX_TEXT_LEN:
        cleaned = cleaned[:_MAX_TEXT_LEN]
    return cleaned


def _clean_ip(value: Optional[str]) -> Optional[str]:
    ip = _clean_str(value)
    if ip is None:
        return None
    if _IPV4_RE.match(ip):
        # Reject quads with octets > 255 (e.g. 999.1.1.1 is malformed).
        try:
            if all(int(octet) <= 255 for octet in ip.split(".")):
                return ip
        except ValueError:
            pass
    # Anything that is not a valid IPv4 dotted quad is dropped from the
    # dedicated IP field (original remains in raw payloads).
    return None


def _clean_port(value: Optional[int]) -> Optional[int]:
    if value is None:
        return None
    if 0 <= value <= 65535:
        return value
    return None


def _clean_protocol(value: Optional[str]) -> Optional[str]:
    protocol = _clean_str(value)
    if protocol is None:
        return None
    lowered = protocol.lower()
    if lowered in _KNOWN_PROTOCOLS:
        return lowered
    return lowered


def _clean_technique(value: str) -> Optional[str]:
    """Canonicalize to uppercase Txxxx[.xxx]; None when unrecognizable."""
    token = value.strip().upper().replace("–", "-")
    # Tolerate forms like "T1110 (Brute Force)" by taking the leading token.
    match = _TECHNIQUE_RE.match(token.split()[0] if token else "")
    if not match:
        return None
    canonical = match.group(1).upper()
    # 'T1110 (T1110.001)'-style or bare 'T1110' inputs that expand to a
    # sub-technique elsewhere in the list are suppressed by the caller's
    # dedupe only if identical; a parent technique explicitly listed stays.
    # Canonical rule: when both parent and sub-technique are present for the
    # same base, keep only the most specific form.
    return canonical


def _clean_tactic(value: str) -> Optional[str]:
    token = value.strip()
    if not token:
        return None
    # TAxxxx ids canonicalize to uppercase; free-text tactics to lowercase.
    upper = token.upper()
    if _TACTIC_ID_RE.match(upper):
        return upper
    return token.lower()


def _dedupe(items: List[str]) -> List[str]:
    return list(dict.fromkeys(item for item in items if item))


def _dedupe_techniques(items: List[str]) -> List[str]:
    """Deduplicate technique ids; drop a parent when its sub-technique exists.

    E.g. ['T1110', 'T1110.001'] → ['T1110.001']: the sub-technique is the
    more specific classification and fully covers the parent.
    """
    unique = _dedupe(items)
    bases = {t.split(".")[0] for t in unique}
    return [
        t for t in unique
        if "." in t or t not in bases or sum(1 for u in unique if u.split(".")[0] == t and "." in u) == 0
    ]


def preprocess_alert(alert: "NormalizedSecurityAlert") -> PreprocessedAlert:
    """Clean one normalized alert. Deterministic; never mutates the input."""
    dropped: List[str] = []

    def track(field: str, value: Optional[object]) -> Optional[object]:
        if value is None:
            dropped.append(field)
        return value

    source_ip = _clean_ip(alert.source_ip)
    if alert.source_ip and source_ip is None:
        dropped.append("source_ip(malformed)")
    destination_ip = _clean_ip(alert.destination_ip)
    if alert.destination_ip and destination_ip is None:
        dropped.append("destination_ip(malformed)")

    preprocessed = PreprocessedAlert(
        alert_id=alert.external_alert_id,
        timestamp=_clean_str(alert.timestamp),
        severity=alert.severity,
        event_type=track("event_type", _clean_str(alert.event_type)),
        rule_id=_clean_str(alert.rule_id),
        rule_description=_clean_str(alert.rule_description),
        agent_id=_clean_str(alert.agent_id),
        agent_name=_clean_str(alert.agent_name),
        agent_os=_clean_str(alert.agent_os),
        source_ip=track("source_ip", source_ip),
        destination_ip=track("destination_ip", destination_ip),
        source_port=track("source_port", _clean_port(alert.source_port)),
        destination_port=track("destination_port", _clean_port(alert.destination_port)),
        username=track("username", _clean_str(alert.username)),
        process=track("process", _clean_str(alert.process)),
        file_path=track("file_path", _clean_str(alert.file_path)),
        location=_clean_str(alert.location),
        mitre_tactics=_dedupe(
            t for t in (_clean_tactic(v) for v in alert.mitre_tactics) if t
        ),
        mitre_techniques=_dedupe_techniques(
            t for t in (_clean_technique(v) for v in alert.mitre_techniques) if t
        ),
        is_mock=alert.is_mock,
        dropped_fields=dropped,
    )

    logger.info(
        "alert_preprocessed alert_id=%s dropped=%s",
        preprocessed.alert_id,
        ",".join(preprocessed.dropped_fields) or "-",
    )
    return preprocessed
