from sqlalchemy import Column, Integer, String, DateTime, Text
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
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    analyses = relationship("Analysis", back_populates="alert")

class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(Integer, sqlalchemy.ForeignKey("alerts.id"))
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
    analysis_id = Column(Integer, sqlalchemy.ForeignKey("analyses.id"))
    source = Column(String)
    document_id = Column(String)
    title = Column(String)
    content = Column(Text)
    relevance_score = Column(sqlalchemy.Float)
    citation = Column(String)

    analysis = relationship("Analysis", back_populates="evidence")

class Feedback(Base):
    __tablename__ = "feedback"
    
    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(Integer, sqlalchemy.ForeignKey("analyses.id"))
    rating = Column(Integer)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
