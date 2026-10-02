import pytest
from pydantic import ValidationError
from app.llm import (
    LLMRequest,
    LLMResponse,
    LLMUsage,
    SOCAnalysis,
    EvidenceReference,
    LLMProviderError
)
from app.llm.providers.mock import MockLLMProvider

def test_llm_request_validation():
    request = LLMRequest(
        system_prompt="You are a SOC assistant.",
        user_prompt="Analyze this alert."
    )
    assert request.temperature == 0.0
    assert request.max_tokens == 1000
    assert request.metadata == {}

    with pytest.raises(ValidationError):
        # Missing required fields
        LLMRequest()

def test_llm_response_validation():
    response = LLMResponse(
        content="This is the analysis.",
        model="gpt-4",
        provider="openai"
    )
    assert response.usage.total_tokens == 0
    assert response.metadata == {}

def test_mock_provider():
    provider = MockLLMProvider(model_name="test-model", provider_name="test-provider")
    request = LLMRequest(system_prompt="sys", user_prompt="usr")
    response = provider.generate(request)
    
    assert response.content == "MOCK_RESPONSE"
    assert response.model == "test-model"
    assert response.provider == "test-provider"
    assert response.usage.prompt_tokens == 10
    assert response.usage.completion_tokens == 20
    assert response.usage.total_tokens == 30
    assert response.metadata["mocked"] is True
    
    # Check that request was saved for assertions
    assert provider.last_request == request

def test_soc_analysis_schema_valid():
    analysis = SOCAnalysis(
        summary="summary",
        severity_assessment="high",
        reasoning="reasons",
        limitations="none",
        confidence="HIGH",
        evidence_references=[
            EvidenceReference(
                evidence_id="e-1",
                claim="claim 1",
                supporting_text="text"
            )
        ]
    )
    assert analysis.confidence == "HIGH"
    assert len(analysis.evidence_references) == 1
    assert analysis.evidence_references[0].evidence_id == "e-1"

def test_soc_analysis_schema_invalid_confidence():
    with pytest.raises(ValidationError):
        SOCAnalysis(
            summary="summary",
            severity_assessment="high",
            reasoning="reasons",
            limitations="none",
            confidence="EXTREME",  # Invalid
        )

def test_immutability():
    req = LLMRequest(system_prompt="s", user_prompt="u")
    with pytest.raises(ValidationError):
        req.system_prompt = "new"

    analysis = SOCAnalysis(
        summary="s",
        severity_assessment="s",
        reasoning="r",
        limitations="l",
        confidence="LOW"
    )
    with pytest.raises(ValidationError):
        analysis.summary = "new"
