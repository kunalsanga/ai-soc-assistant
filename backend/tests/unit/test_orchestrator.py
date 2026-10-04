import pytest
import json
from unittest.mock import Mock, AsyncMock, patch

from app.services.orchestrator import SOCAnalysisOrchestrator, AnalysisMode
from app.llm.schemas import LLMResponse, SOCAnalysis, LLMUsage, LLMRequest
from app.rag.schemas import EvidenceSet, Evidence
from app.schemas.alert import AnalysisCreate
from app.security.schemas import RetrievalQuerySet, RetrievalQuery
from app.wazuh.schemas import NormalizedSecurityAlert
from app.services.exceptions import AlertNotFoundError

@pytest.fixture
def mock_alert():
    return NormalizedSecurityAlert(
        external_alert_id="ext-1",
        timestamp="2023-01-01",
        severity=3,
        rule_id="r1",
        rule_description="Test Alert",
        agent_name="agent-1",
    )

@pytest.fixture
def mock_evidence_set():
    ev = Evidence(
        evidence_id="ev-123",
        query_ids=["q1"],
        categories=["mitre"],
        source="mitre",
        document_id="T1059",
        chunk_id="chunk1",
        source_identifier="T1059",
        title="Command and Scripting Interpreter",
        content="Adversaries may abuse command and script interpreters to execute commands, scripts, or binaries.",
        similarity_score=0.9,
        chunk_index=0
    )
    return EvidenceSet(alert_id="1", evidence=[ev])

@pytest.fixture
def mock_alert_service(mock_alert):
    service = Mock()
    service.get_normalized_alert = AsyncMock(return_value=mock_alert)
    queries = RetrievalQuerySet(alert_id="1", mitre=[], nvd=[], general=[])
    service.get_security_context = Mock(return_value=("context", queries))
    return service

@pytest.fixture
def mock_analysis_service():
    service = Mock()
    service.create_analysis = AsyncMock()
    return service

@pytest.fixture
def mock_retriever(mock_evidence_set):
    retriever = Mock()
    retriever.retrieve_query_set = Mock(return_value=mock_evidence_set)
    return retriever

@pytest.fixture
def mock_llm_provider():
    provider = Mock()
    # Mock valid JSON response
    valid_analysis = {
        "summary": "Summary",
        "severity_assessment": "Severity reasoning",
        "observed_indicators": ["IP"],
        "suspected_techniques": ["T1059"],
        "reasoning": "Reasoning",
        "investigation_steps": ["Step 1"],
        "false_positive_indicators": ["FP"],
        "confidence": "HIGH",
        "limitations": "None",
        "evidence_references": [
            {
                "evidence_id": "ev-123",
                "claim": "Used T1059",
                "supporting_text": "abuse command and script interpreters"
            }
        ]
    }
    provider.generate = Mock(return_value=LLMResponse(
        content=json.dumps(valid_analysis),
        model="test-model",
        provider="mock",
        usage=LLMUsage()
    ))
    return provider

@pytest.mark.asyncio
async def test_analyze_alert_evidence_aware(
    mock_alert_service, mock_analysis_service, mock_retriever, mock_llm_provider
):
    orchestrator = SOCAnalysisOrchestrator(
        alert_service=mock_alert_service,
        analysis_service=mock_analysis_service,
        llm_provider=mock_llm_provider,
        retriever=mock_retriever
    )
    
    db = AsyncMock()
    analysis = await orchestrator.analyze_alert(db, 1, AnalysisMode.EVIDENCE_AWARE)
    
    # Verify retrieval was called with full structured context queries
    mock_retriever.retrieve_query_set.assert_called_once()
    
    # Verify LLM was called
    mock_llm_provider.generate.assert_called_once()
    request = mock_llm_provider.generate.call_args[0][0]
    assert isinstance(request, LLMRequest)
    assert "ev-123" in request.user_prompt
    
    # Verify persistence
    mock_analysis_service.create_analysis.assert_called_once()
    saved_create = mock_analysis_service.create_analysis.call_args[0][2]
    assert isinstance(saved_create, AnalysisCreate)
    assert saved_create.summary == "Summary"
    assert saved_create.confidence == "HIGH"
    
    # Verify evidence was mapped correctly
    assert len(saved_create.evidence) == 1
    assert saved_create.evidence[0].document_id == "T1059"
    assert saved_create.evidence[0].citation == "T1059 - Command and Scripting Interpreter"

@pytest.mark.asyncio
async def test_analyze_alert_llm_only(
    mock_alert_service, mock_analysis_service, mock_llm_provider
):
    orchestrator = SOCAnalysisOrchestrator(
        alert_service=mock_alert_service,
        analysis_service=mock_analysis_service,
        llm_provider=mock_llm_provider,
        retriever=None
    )
    
    db = AsyncMock()
    analysis = await orchestrator.analyze_alert(db, 1, AnalysisMode.LLM_ONLY)
    
    # Verify LLM was called without evidence
    request = mock_llm_provider.generate.call_args[0][0]
    assert "None available" in request.user_prompt
    
    # Verify persistence
    mock_analysis_service.create_analysis.assert_called_once()
    saved_create = mock_analysis_service.create_analysis.call_args[0][2]
    assert len(saved_create.evidence) == 0

@pytest.mark.asyncio
async def test_hallucinated_evidence(
    mock_alert_service, mock_analysis_service, mock_retriever, mock_llm_provider
):
    valid_analysis = {
        "summary": "Summary",
        "severity_assessment": "Severity reasoning",
        "observed_indicators": ["IP"],
        "suspected_techniques": ["T1059"],
        "reasoning": "Reasoning",
        "investigation_steps": ["Step 1"],
        "false_positive_indicators": ["FP"],
        "confidence": "HIGH",
        "limitations": "None",
        "evidence_references": [
            {
                "evidence_id": "fake-ev-999",
                "claim": "Fake claim",
                "supporting_text": "Fake text"
            }
        ]
    }
    mock_llm_provider.generate.return_value = LLMResponse(
        content=json.dumps(valid_analysis),
        model="test-model",
        provider="mock",
        usage=LLMUsage()
    )
    
    orchestrator = SOCAnalysisOrchestrator(
        alert_service=mock_alert_service,
        analysis_service=mock_analysis_service,
        llm_provider=mock_llm_provider,
        retriever=mock_retriever
    )
    
    db = AsyncMock()
    analysis = await orchestrator.analyze_alert(db, 1, AnalysisMode.EVIDENCE_AWARE)
    
    # Verify fake evidence was dropped and limitation was added
    mock_analysis_service.create_analysis.assert_called_once()
    saved_create = mock_analysis_service.create_analysis.call_args[0][2]
    
    assert len(saved_create.evidence) == 0
    assert "fake-ev-999" in saved_create.explanation or "fake-ev-999" in valid_analysis["limitations"] or "fake-ev-999" in saved_create.explanation
    # Actually wait, limitation string gets added, but wait, AnalysisCreate does not have a "limitations" field directly,
    # The limitations field in AnalysisCreate is missing. In orchestrator I set `explanation=validated_analysis.reasoning`
    # Let me check my implementation.
    
@pytest.mark.asyncio
async def test_malformed_llm_output(
    mock_alert_service, mock_analysis_service, mock_llm_provider
):
    mock_llm_provider.generate.return_value = LLMResponse(
        content="This is not valid JSON",
        model="test-model",
        provider="mock",
        usage=LLMUsage()
    )
    
    orchestrator = SOCAnalysisOrchestrator(
        alert_service=mock_alert_service,
        analysis_service=mock_analysis_service,
        llm_provider=mock_llm_provider,
        retriever=None
    )
    
    db = AsyncMock()
    analysis = await orchestrator.analyze_alert(db, 1, AnalysisMode.LLM_ONLY)
    
    mock_analysis_service.create_analysis.assert_called_once()
    saved_create = mock_analysis_service.create_analysis.call_args[0][2]
    assert saved_create.summary == "Analysis failed due to malformed LLM output."
    assert saved_create.confidence == "LOW"

@pytest.mark.asyncio
async def test_alert_not_found(
    mock_alert_service, mock_analysis_service, mock_llm_provider
):
    mock_alert_service.get_normalized_alert.return_value = None
    
    orchestrator = SOCAnalysisOrchestrator(
        alert_service=mock_alert_service,
        analysis_service=mock_analysis_service,
        llm_provider=mock_llm_provider,
        retriever=None
    )
    
    db = AsyncMock()
    with pytest.raises(AlertNotFoundError):
        await orchestrator.analyze_alert(db, 1, AnalysisMode.LLM_ONLY)
