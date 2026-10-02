from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

class LLMUsage(BaseModel):
    model_config = ConfigDict(frozen=True)
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0

class LLMRequest(BaseModel):
    model_config = ConfigDict(frozen=True)
    system_prompt: str
    user_prompt: str
    temperature: float = 0.0
    max_tokens: int = 1000
    metadata: Dict[str, Any] = Field(default_factory=dict)

class LLMResponse(BaseModel):
    model_config = ConfigDict(frozen=True)
    content: str
    model: str
    provider: str
    usage: LLMUsage = Field(default_factory=LLMUsage)
    metadata: Dict[str, Any] = Field(default_factory=dict)

class EvidenceReference(BaseModel):
    model_config = ConfigDict(frozen=True)
    evidence_id: str
    claim: str
    supporting_text: str

class SOCAnalysis(BaseModel):
    model_config = ConfigDict(frozen=True)
    summary: str
    severity_assessment: str
    observed_indicators: List[str] = Field(default_factory=list)
    suspected_techniques: List[str] = Field(default_factory=list)
    reasoning: str
    investigation_steps: List[str] = Field(default_factory=list)
    false_positive_indicators: List[str] = Field(default_factory=list)
    confidence: str = Field(pattern="^(LOW|MEDIUM|HIGH|CRITICAL)$")
    limitations: str
    evidence_references: List[EvidenceReference] = Field(default_factory=list)
