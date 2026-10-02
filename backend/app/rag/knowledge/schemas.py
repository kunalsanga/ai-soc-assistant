"""Source-agnostic knowledge models for the security knowledge base.

Every indexed item is traceable to its origin (source → document → chunk) so
the future evidence-grounding experiment can answer: *where did this come
from?* These models are pure Pydantic v2 domain objects — deliberately NOT
persisted to PostgreSQL; the knowledge index lives in Qdrant and can be
rebuilt independently at any time.

Knowledge is DATA, never executable instructions (spec Step 15).
"""
from pydantic import BaseModel, ConfigDict, Field
from typing import Any, Dict, List, Optional


class KnowledgeDocument(BaseModel):
    """A single normalized knowledge document from one authoritative source."""

    model_config = ConfigDict(frozen=True)

    document_id: str = Field(min_length=1)  # stable, source-namespaced, e.g. "mitre:attack:T1110"
    source: str = Field(min_length=1)  # e.g. "mitre_attack", "nvd_cve"
    document_type: str = Field(min_length=1)  # e.g. "technique", "cve_record", "doc_page"
    title: str = Field(min_length=1)
    content: str = Field(min_length=1)
    source_url: Optional[str] = None
    source_identifier: Optional[str] = None  # e.g. "T1110", "CVE-2024-12345"
    metadata: Dict[str, Any] = Field(default_factory=dict)
    version: Optional[str] = None  # source record version, when available
    created: Optional[str] = None  # source publication/creation date
    updated: Optional[str] = None  # source modification date


class KnowledgeChunk(BaseModel):
    """A retrievable slice of a KnowledgeDocument with full provenance."""

    model_config = ConfigDict(frozen=True)

    chunk_id: str  # stable: "{document_id}::{chunk_index}"
    document_id: str
    source: str  # denormalized from the document for traceability
    source_identifier: Optional[str] = None
    source_url: Optional[str] = None
    title: str
    chunk_index: int = Field(ge=0)
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class KnowledgeProvenance(BaseModel):
    """Provenance block embedded in every Qdrant payload (spec Step 13)."""

    source: str
    document_id: str
    source_identifier: Optional[str] = None
    source_url: Optional[str] = None
    chunk_id: str
    chunk_index: int
    title: str
