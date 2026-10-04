from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class AlertBase(BaseModel):
    external_alert_id: str
    timestamp: str
    severity: int
    rule_id: str
    rule_description: str
    agent_name: Optional[str] = None
    source_ip: Optional[str] = None
    destination_ip: Optional[str] = None
    username: Optional[str] = None
    raw_data: Optional[str] = None
    status: str = "open"

class AlertCreate(AlertBase):
    pass

class Alert(AlertBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class EvidenceCreate(BaseModel):
    """Input schema for creating a single Evidence item."""

    source: str
    document_id: str
    title: str
    content: str
    relevance_score: float
    citation: str


class EvidenceSchema(BaseModel):
    """Response schema for a persisted Evidence item."""

    id: int
    analysis_id: int
    source: str
    document_id: str
    title: str
    content: str
    relevance_score: float
    citation: str

    class Config:
        from_attributes = True

class AnalysisCreate(BaseModel):
    """Input schema for creating an Analysis record.

    All content fields are Optional because an analysis may be created in a
    'pending' state before the LLM pipeline runs, or with partial results.
    The alert_id is NOT included here — it is supplied as a path parameter
    or function argument by the service layer.
    """

    summary: Optional[str] = None
    severity_assessment: Optional[str] = None
    explanation: Optional[str] = None
    recommended_investigation: Optional[str] = None
    confidence: Optional[str] = None
    model_name: Optional[str] = None
    analysis_type: Optional[str] = None
    evidence: List[EvidenceCreate] = []


class AnalysisSchema(BaseModel):
    """Response schema for a persisted Analysis record.

    All content fields are Optional because the DB columns are nullable and
    an analysis may be stored in a 'pending' state without content yet.
    This matches the frontend TypeScript interface where all Analysis fields
    are already declared as optional.
    """

    id: int
    alert_id: int
    summary: Optional[str] = None
    severity_assessment: Optional[str] = None
    explanation: Optional[str] = None
    recommended_investigation: Optional[str] = None
    confidence: Optional[str] = None
    model_name: Optional[str] = None
    analysis_type: Optional[str] = None
    created_at: datetime
    evidence: List[EvidenceSchema] = []

    class Config:
        from_attributes = True

class AnalysisPlaceholder(BaseModel):
    status: str
    message: str
