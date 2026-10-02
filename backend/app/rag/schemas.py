from pydantic import BaseModel, ConfigDict, Field
from typing import Any, Dict, List, Optional

class Evidence(BaseModel):
    """An atomic piece of knowledge retrieved as evidence for a claim.
    
    This preserves full provenance to its authoritative source.
    """
    model_config = ConfigDict(frozen=True)

    evidence_id: str  # Unique identifier for the evidence in this retrieval context
    query_ids: List[str]  # The IDs of all RetrievalQueries that fetched this evidence
    categories: List[str] # The categories of the originating queries (e.g., 'mitre', 'nvd')

    
    # Provenance fields (must never be lost)
    source: str
    document_id: str
    chunk_id: str
    source_identifier: Optional[str] = None
    source_url: Optional[str] = None
    title: str
    content: str
    
    # Retrieval metadata
    similarity_score: float
    chunk_index: int
    metadata: Dict[str, Any] = Field(default_factory=dict)


class EvidenceSet(BaseModel):
    """A deterministic, ranked collection of evidence retrieved for an alert."""
    model_config = ConfigDict(frozen=True)
    
    alert_id: str
    evidence: List[Evidence] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
