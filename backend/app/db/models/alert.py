from sqlalchemy import Column, Integer, String, DateTime, Text, Float, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.database import Base

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    external_alert_id = Column(String, unique=True, index=True)
    timestamp = Column(String)
    severity = Column(Integer)
    rule_id = Column(String)
    rule_description = Column(String)
    agent_name = Column(String)
    source_ip = Column(String, nullable=True)
    destination_ip = Column(String, nullable=True)
    username = Column(String, nullable=True)
    raw_data = Column(Text, nullable=True)
    status = Column(String, default="open")
    data_source = Column(String, default="demo", index=True, nullable=True)
    ingestion_timestamp = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    analyses = relationship("Analysis", back_populates="alert")

    @property
    def data_origin(self) -> str:
        if not self.raw_data:
            return "wazuh_mock"
        try:
            import json
            return json.loads(self.raw_data).get("data_origin", "wazuh_mock")
        except Exception:
            return "wazuh_mock"

    @property
    def dataset_version(self) -> str | None:
        if not self.raw_data:
            return None
        try:
            import json
            return json.loads(self.raw_data).get("dataset_version")
        except Exception:
            return None

    @property
    def scenario_id(self) -> str | None:
        if not self.raw_data:
            return None
        try:
            import json
            return json.loads(self.raw_data).get("scenario_id")
        except Exception:
            return None

    @property
    def scenario_title(self) -> str | None:
        if not self.raw_data:
            return None
        try:
            import json
            return json.loads(self.raw_data).get("scenario_title")
        except Exception:
            return None

    @property
    def provenance(self) -> dict:
        return {
            "source_type": self.data_source or "demo",
            "original_event_id": self.external_alert_id,
            "event_timestamp": self.timestamp,
            "ingestion_timestamp": self.ingestion_timestamp or (self.created_at.isoformat() if self.created_at else None),
            "dataset_version": self.dataset_version,
            "scenario_id": self.scenario_id,
        }


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(Integer, ForeignKey("alerts.id"))
    summary = Column(Text)
    severity_assessment = Column(String)
    explanation = Column(Text)
    recommended_investigation = Column(Text)
    confidence = Column(String)
    model_name = Column(String)
    analysis_type = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    alert = relationship("Alert", back_populates="analyses")
    evidence = relationship("Evidence", back_populates="analysis")

class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id"))
    source = Column(String)
    document_id = Column(String)
    title = Column(String)
    content = Column(Text)
    relevance_score = Column(Float)
    citation = Column(String)

    analysis = relationship("Analysis", back_populates="evidence")

class Feedback(Base):
    __tablename__ = "feedback"
    
    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id"))
    rating = Column(Integer)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
