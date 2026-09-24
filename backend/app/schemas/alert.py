from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class AlertBase(BaseModel):
    external_alert_id: str
    timestamp: str
    severity: int
    rule_id: str
    rule_description: str
    agent_name: str
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

class EvidenceSchema(BaseModel):
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

class AnalysisSchema(BaseModel):
    id: int
    alert_id: int
    summary: str
    severity_assessment: str
    explanation: str
    recommended_investigation: str
    confidence: str
    model_name: str
    analysis_type: str
    created_at: datetime
    evidence: List[EvidenceSchema] = []

    class Config:
        from_attributes = True

class AnalysisPlaceholder(BaseModel):
    status: str
    message: str
