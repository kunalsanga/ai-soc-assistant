import json
import logging
from enum import Enum
from typing import Optional, List, Tuple

from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.llm.provider import LLMProvider
from app.llm.schemas import LLMRequest, SOCAnalysis, EvidenceReference
from app.rag.retriever import Retriever
from app.rag.schemas import EvidenceSet
from app.schemas.alert import AnalysisCreate, EvidenceCreate
from app.security.schemas import RetrievalQuerySet, RetrievalQuery
from app.wazuh.schemas import NormalizedSecurityAlert
from app.wazuh.service import AlertService
from app.services.analysis import AnalysisService
from app.services.exceptions import AlertNotFoundError

logger = logging.getLogger(__name__)

class AnalysisMode(str, Enum):
    LLM_ONLY = "llm_only"
    STANDARD_RAG = "standard_rag"
    EVIDENCE_AWARE = "evidence_aware"

class SOCAnalysisOrchestrator:
    """Orchestrates the entire SOC analysis pipeline.
    
    Coordinates the AlertService, Retriever, LLMProvider, and AnalysisService.
    Does not contain underlying logic for extraction, retrieval, or persistence.
    """
    
    def __init__(
        self,
        alert_service: AlertService,
        analysis_service: AnalysisService,
        llm_provider: LLMProvider,
        retriever: Optional[Retriever] = None,
    ):
        self._alert_service = alert_service
        self._analysis_service = analysis_service
        self._llm_provider = llm_provider
        self._retriever = retriever

    async def analyze_alert(
        self,
        db: AsyncSession,
        alert_id: int,
        mode: AnalysisMode = AnalysisMode.EVIDENCE_AWARE,
    ) -> "app.db.models.alert.Analysis":
        """Run the end-to-end analysis pipeline and persist the result."""
        
        # 1. Fetch normalized alert
        alert = await self._alert_service.get_normalized_alert(db, alert_id)
        if alert is None:
            raise AlertNotFoundError(f"Alert with id={alert_id} not found")

        # 2. Extract context / Queries
        context, structured_queries = self._alert_service.get_security_context(alert)
        
        # 3. Retrieve Evidence based on mode
        evidence_set = None
        if mode == AnalysisMode.STANDARD_RAG and self._retriever:
            # Standard RAG: Naive single query from rule description
            naive_query = RetrievalQuery(
                query_id="naive_1",
                text=alert.rule_description or alert.event_type or "security alert",
                category="general"
            )
            naive_query_set = RetrievalQuerySet(
                alert_id=str(alert_id),
                mitre=[],
                nvd=[],
                general=[naive_query]
            )
            evidence_set = self._retriever.retrieve_query_set(naive_query_set)
            
        elif mode == AnalysisMode.EVIDENCE_AWARE and self._retriever:
            # Evidence-Aware RAG: Full structured context queries
            evidence_set = self._retriever.retrieve_query_set(structured_queries)

        # 4. Construct LLM prompt
        system_prompt, user_prompt = self._build_prompts(alert, evidence_set)
        
        request = LLMRequest(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.0,
            max_tokens=2000
        )
        
        # 5. Execute LLM
        response = self._llm_provider.generate(request)
        
        # 6. Parse and validate JSON
        soc_analysis = self._parse_llm_response(response.content)
        
        # 7. Validate Evidence Grounding
        validated_analysis, evidence_creates = self._validate_evidence(soc_analysis, evidence_set)
        
        explanation_text = validated_analysis.reasoning
        if validated_analysis.limitations:
            explanation_text += f"\n\nLimitations/Notes:\n{validated_analysis.limitations}"
            
        # 8. Persist Analysis
        analysis_create = AnalysisCreate(
            summary=validated_analysis.summary,
            severity_assessment=validated_analysis.severity_assessment,
            explanation=explanation_text,
            recommended_investigation="\n".join(validated_analysis.investigation_steps) if validated_analysis.investigation_steps else "None",
            confidence=validated_analysis.confidence,
            model_name=response.model,
            analysis_type=mode.value,
            evidence=evidence_creates
        )
        
        analysis = await self._analysis_service.create_analysis(db, alert_id, analysis_create)
        
        return analysis

    def _build_prompts(self, alert: NormalizedSecurityAlert, evidence_set: Optional[EvidenceSet]) -> Tuple[str, str]:
        system_prompt = (
            "You are an expert AI Security Operations Center (SOC) Analyst.\n"
            "Your job is to analyze the provided security alert and return a structured JSON response.\n"
            "You must output ONLY valid JSON matching the following schema. Do not output markdown, reasoning outside JSON, or any other text.\n\n"
            "{\n"
            '  "summary": "1-2 sentence summary of the alert",\n'
            '  "severity_assessment": "Why is this severity appropriate?",\n'
            '  "observed_indicators": ["ip", "hash", "username"],\n'
            '  "suspected_techniques": ["T1059", "etc"],\n'
            '  "reasoning": "Detailed logical explanation of what happened",\n'
            '  "investigation_steps": ["Check logs", "Isolate host (recommendation only)"],\n'
            '  "false_positive_indicators": ["Reasons this might be benign"],\n'
            '  "confidence": "LOW", "MEDIUM", "HIGH", or "CRITICAL",\n'
            '  "limitations": "What is unknown or missing",\n'
            '  "evidence_references": [\n'
            '    {\n'
            '      "evidence_id": "Must exactly match a provided evidence_id",\n'
            '      "claim": "The claim being made",\n'
            '      "supporting_text": "Quote from evidence"\n'
            '    }\n'
            '  ]\n'
            "}\n\n"
            "RULES:\n"
            "1. NEVER invent evidence or use fake evidence_ids.\n"
            "2. If no evidence is provided or sufficient, state it in limitations.\n"
            "3. Investigation steps must be NON-DESTRUCTIVE recommendations. Do not assume automatic remediation.\n"
            "4. Clearly distinguish observed facts from hypotheses.\n"
        )
        
        user_prompt = f"ALERT DETAILS:\n{alert.model_dump_json(indent=2)}\n\n"
        
        if evidence_set and evidence_set.evidence:
            user_prompt += "RETRIEVED EVIDENCE:\n"
            for ev in evidence_set.evidence:
                user_prompt += f"--- EVIDENCE ID: {ev.evidence_id} ---\n"
                user_prompt += f"Source: {ev.source} | Title: {ev.title}\n"
                user_prompt += f"Content: {ev.content}\n\n"
        else:
            user_prompt += "RETRIEVED EVIDENCE: None available.\n"
            
        return system_prompt, user_prompt

    def _parse_llm_response(self, content: str) -> SOCAnalysis:
        cleaned = content.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        
        try:
            data = json.loads(cleaned)
            return SOCAnalysis(**data)
        except (json.JSONDecodeError, ValidationError) as e:
            logger.error(f"Failed to parse LLM response: {e}")
            return SOCAnalysis(
                summary="Analysis failed due to malformed LLM output.",
                severity_assessment="Unknown",
                reasoning=f"Error parsing LLM response: {str(e)}",
                confidence="LOW",
                limitations="Output format error."
            )
            
    def _validate_evidence(self, analysis: SOCAnalysis, evidence_set: Optional[EvidenceSet]) -> Tuple[SOCAnalysis, List[EvidenceCreate]]:
        valid_evidence_dict = {ev.evidence_id: ev for ev in evidence_set.evidence} if evidence_set else {}
        
        validated_refs = []
        limitations = analysis.limitations
        evidence_creates = []
        
        for ref in analysis.evidence_references:
            if ref.evidence_id in valid_evidence_dict:
                validated_refs.append(ref)
                ev = valid_evidence_dict[ref.evidence_id]
                evidence_creates.append(EvidenceCreate(
                    source=ev.source,
                    document_id=ev.document_id,
                    title=ev.title,
                    content=ev.content,
                    relevance_score=ev.similarity_score,
                    citation=f"{ev.source_identifier} - {ev.title}"
                ))
            else:
                logger.warning(f"LLM referenced unknown evidence_id: {ref.evidence_id}")
                limitations += f"\nNote: LLM hallucinated unknown evidence reference '{ref.evidence_id}'."
                
        # Deduplicate evidence creates to prevent DB constraint errors
        seen = set()
        unique_evidence_creates = []
        for ec in evidence_creates:
            key = (ec.source, ec.document_id, ec.title)
            if key not in seen:
                seen.add(key)
                unique_evidence_creates.append(ec)
                
        validated_analysis = SOCAnalysis(
            summary=analysis.summary,
            severity_assessment=analysis.severity_assessment,
            observed_indicators=analysis.observed_indicators,
            suspected_techniques=analysis.suspected_techniques,
            reasoning=analysis.reasoning,
            investigation_steps=analysis.investigation_steps,
            false_positive_indicators=analysis.false_positive_indicators,
            confidence=analysis.confidence,
            limitations=limitations,
            evidence_references=validated_refs
        )
        
        return validated_analysis, unique_evidence_creates
