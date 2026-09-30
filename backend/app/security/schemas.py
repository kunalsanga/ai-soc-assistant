"""Phase 3 domain schemas: preprocessing output, security context, retrieval queries.

These models are:
- typed and optional-safe (alerts rarely carry every field)
- deterministic and serializable (plain Pydantic v2 models)
- NOT persisted — Phase 3 operates purely on the normalized alert in memory.

Boundary note: `SecurityContext` structures what the alert *actually contains*.
It never adds threat-intelligence judgments (reputation, geolocation,
maliciousness) — that belongs to later retrieval/LLM phases, and inventing it
here would be hallucination (spec: "Never hallucinate context").
"""
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional


class PreprocessedAlert(BaseModel):
    """Cleaned view of a NormalizedSecurityAlert.

    Field values are whitespace-trimmed / case-normalized where safe.
    The original alert is never mutated; raw payloads remain available on
    the NormalizedSecurityAlert for audit purposes.
    """

    alert_id: str
    timestamp: Optional[str] = None
    severity: int = 0
    event_type: Optional[str] = None
    rule_id: Optional[str] = None
    rule_description: Optional[str] = None
    agent_id: Optional[str] = None
    agent_name: Optional[str] = None
    agent_os: Optional[str] = None
    source_ip: Optional[str] = None
    destination_ip: Optional[str] = None
    source_port: Optional[int] = None
    destination_port: Optional[int] = None
    protocol: Optional[str] = None
    username: Optional[str] = None
    process: Optional[str] = None
    file_path: Optional[str] = None
    location: Optional[str] = None
    mitre_tactics: List[str] = Field(default_factory=list)
    mitre_techniques: List[str] = Field(default_factory=list)
    is_mock: bool = False
    dropped_fields: List[str] = Field(default_factory=list)


class SecurityContext(BaseModel):
    """Structured security context extracted from a preprocessed alert.

    Only fields actually present in the alert are populated. Lists are
    de-duplicated preserving first-seen order. Nothing is inferred.
    """

    alert_id: str
    event_type: Optional[str] = None
    severity: int = 0
    rule_id: Optional[str] = None
    rule_description: Optional[str] = None
    agent_name: Optional[str] = None
    entities: Dict[str, List[str]] = Field(default_factory=dict)
    mitre_techniques: List[str] = Field(default_factory=list)
    mitre_tactics: List[str] = Field(default_factory=list)
    keywords: List[str] = Field(default_factory=list)


class RetrievalQuery(BaseModel):
    """One deterministic retrieval query for the future RAG layer."""

    query_id: str
    category: str  # "mitre" | "nvd" | "security"
    text: str
    source_hint: Optional[str] = None  # e.g. "MITRE", "NVD"
    metadata: Dict[str, Any] = Field(default_factory=dict)


class RetrievalQuerySet(BaseModel):
    """Categorized query bundle produced from one alert's security context."""

    alert_id: str
    mitre_queries: List[RetrievalQuery] = Field(default_factory=list)
    nvd_queries: List[RetrievalQuery] = Field(default_factory=list)
    security_queries: List[RetrievalQuery] = Field(default_factory=list)

    def all_queries(self) -> List[RetrievalQuery]:
        """All queries in stable category order (mitre, nvd, security)."""
        return self.mitre_queries + self.nvd_queries + self.security_queries
