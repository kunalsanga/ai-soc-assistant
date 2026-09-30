"""ContextExtractor: structured SecurityContext from a PreprocessedAlert.

Rules (spec Steps 2B and 4):
- Extracts and structures only what the alert actually contains.
- Never infers reputation, geolocation, or maliciousness — no threat-intel
  lookups at this layer.
- MITRE technique IDs come from the alert itself (already canonicalized by
  the preprocessor); no external mapping is consulted.
- Keywords are derived deterministically from alert text (event type, rule
  description) via a fixed stop-word list — no randomness, no LLM.
"""
from __future__ import annotations

import logging
import re
from typing import Dict, List, Optional

from app.security.schemas import PreprocessedAlert, SecurityContext

logger = logging.getLogger(__name__)

_TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z0-9_\-\.]{1,}")

# Small fixed stop-word list; intentionally minimal and deterministic.
_STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "had",
    "has", "have", "in", "is", "it", "its", "of", "on", "or", "that", "the",
    "this", "to", "was", "were", "will", "with",
}

# Tokens that carry little retrieval value even outside stop-word rules.
_NOISE_TOKENS = {
    "sshd", "syslog", "log", "logs", "alert", "rule", "fired", "triggered",
    "attempt", "attempts", "detected", "detected.", "event",
}

# Words that signal the attack category of an event; extracted as keywords.
_ATTACK_TERMS = {
    "brute", "force", "bruteforce", "login", "authentication", "auth",
    "password", "credential", "credentials", "scan", "scanner", "scanning",
    "exploit", "injection", "sql", "xss", "malware", "backdoor", "rootkit",
    "privilege", "escalation", "lateral", "movement", "phishing", "ransomware",
    "exfiltration", "persistence", "reconnaissance", "denial", "service",
    "dos", "ddos", "suspicious", "unauthorized", "non-existent", "failed",
    "failure", "failures", "multiple",
}


def _dedupe(items: List[str]) -> List[str]:
    return list(dict.fromkeys(item for item in items if item))


def _keywords_from_text(text: Optional[str]) -> List[str]:
    if not text:
        return []
    tokens = [t.lower().strip(".:,;()[]") for t in _TOKEN_RE.findall(text)]
    keywords: List[str] = []
    for token in tokens:
        if token in _STOP_WORDS or token in _NOISE_TOKENS:
            continue
        if len(token) < 3:
            continue
        keywords.append(token)
    return _dedupe(keywords)


def _attack_terms(text: Optional[str]) -> List[str]:
    if not text:
        return []
    tokens = {t.lower().strip(".:,;()[]") for t in _TOKEN_RE.findall(text)}
    found = [term for term in sorted(_ATTACK_TERMS) if term in tokens]
    return found


class ContextExtractor:
    """Extracts a structured SecurityContext from a PreprocessedAlert."""

    def extract(self, alert: PreprocessedAlert) -> SecurityContext:
        entities: Dict[str, List[str]] = {}

        def add_entity(key: str, value: Optional[object]) -> None:
            if value is None:
                return
            if isinstance(value, str):
                if not value.strip():
                    return
                entities.setdefault(key, []).append(value.strip())
            elif isinstance(value, int):
                entities.setdefault(key, []).append(str(value))

        # --- network indicators ------------------------------------------
        add_entity("source_ip", alert.source_ip)
        add_entity("destination_ip", alert.destination_ip)
        add_entity("source_port", alert.source_port)
        add_entity("destination_port", alert.destination_port)

        # --- identity / host ----------------------------------------------
        add_entity("username", alert.username)
        add_entity("agent_name", alert.agent_name)
        add_entity("agent_os", alert.agent_os)
        add_entity("location", alert.location)

        # --- process / file ------------------------------------------------
        add_entity("process", alert.process)
        add_entity("file_path", alert.file_path)

        # --- keyword derivation (deterministic) -----------------------------
        text_sources = [alert.rule_description, alert.event_type]
        keywords: List[str] = []
        for source in text_sources:
            keywords.extend(_keywords_from_text(source))
        keywords = _dedupe(keywords)

        attack_terms = _dedupe(
            _attack_terms(alert.rule_description) + _attack_terms(alert.event_type)
        )

        context = SecurityContext(
            alert_id=alert.alert_id,
            event_type=alert.event_type,
            severity=alert.severity,
            rule_id=alert.rule_id,
            rule_description=alert.rule_description,
            agent_name=alert.agent_name,
            entities=entities,
            mitre_techniques=list(alert.mitre_techniques),
            mitre_tactics=list(alert.mitre_tactics),
            keywords=_dedupe(keywords + attack_terms),
        )

        logger.info(
            "context_extracted alert_id=%s entities=%s techniques=%s keywords=%d",
            context.alert_id,
            ",".join(sorted(entities.keys())) or "-",
            ",".join(context.mitre_techniques) or "-",
            len(context.keywords),
        )
        return context
