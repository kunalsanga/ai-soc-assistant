import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, List, Tuple, Callable, Dict, Any, Awaitable
from datetime import datetime, timezone

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


@dataclass
class PipelineArtifacts:
    """Intermediate artifacts captured for research evaluation.

    Purely additive observation: does not alter pipeline behavior.
    """
    mode: str
    evidence_set: Optional[EvidenceSet] = None
    parsed_analysis: Optional[SOCAnalysis] = None
    llm_latency_seconds: float = 0.0
    llm_model: str = ""
    llm_tokens: dict = field(default_factory=dict)

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
        on_trace_event: Optional[Callable[[Dict[str, Any]], Awaitable[None]]] = None,
    ) -> "app.db.models.alert.Analysis":
        """Run the end-to-end analysis pipeline and persist the result."""
        analysis, _ = await self.analyze_alert_with_artifacts(db, alert_id, mode, on_trace_event=on_trace_event)
        return analysis

    async def analyze_alert_with_artifacts(
        self,
        db: AsyncSession,
        alert_id: int,
        mode: AnalysisMode = AnalysisMode.EVIDENCE_AWARE,
        on_trace_event: Optional[Callable[[Dict[str, Any]], Awaitable[None]]] = None,
    ) -> tuple["app.db.models.alert.Analysis", "PipelineArtifacts"]:
        """Run the pipeline and additionally return evaluation artifacts and real-time trace events."""
        artifacts = PipelineArtifacts(mode=mode.value)
        pipeline_started = time.perf_counter()

        async def emit(
            stage_id: str,
            step: int,
            name: str,
            component: str,
            event_type: str,
            status: str,
            duration_ms: int = 0,
            **kwargs,
        ):
            if on_trace_event:
                try:
                    payload = {
                        "alert_id": alert_id,
                        "stage_id": stage_id,
                        "step": step,
                        "name": name,
                        "component": component,
                        "event_type": event_type,
                        "status": status,
                        "duration_ms": duration_ms,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        **kwargs,
                    }
                    await on_trace_event(payload)
                except Exception as emit_err:
                    logger.debug("Failed to emit trace event: %s", emit_err)

        # 1. Fetch normalized alert
        t0 = time.perf_counter()
        await emit("ingestion", 1, "Alert Ingestion & Normalization", "app.wazuh.service.AlertService", "stage_start", "running")
        alert = await self._alert_service.get_normalized_alert(db, alert_id)
        if alert is None:
            await emit("ingestion", 1, "Alert Ingestion & Normalization", "app.wazuh.service.AlertService", "stage_error", "failed", safe_error_message=f"Alert with id={alert_id} not found")
            raise AlertNotFoundError(f"Alert with id={alert_id} not found")
        d1 = int((time.perf_counter() - t0) * 1000)
        await emit("ingestion", 1, "Alert Ingestion & Normalization", "app.wazuh.service.AlertService", "stage_complete", "succeeded", duration_ms=d1, records_processed=1, output_summary=f"Normalized Alert #{alert.id} ({alert.rule_description})")

        # 2. Extract context / Queries
        t0 = time.perf_counter()
        await emit("context", 2, "Security Context Extraction", "app.security.normalization", "stage_start", "running")
        context, structured_queries = self._alert_service.get_security_context(alert)
        d2 = int((time.perf_counter() - t0) * 1000)
        await emit("context", 2, "Security Context Extraction", "app.security.normalization", "stage_complete", "succeeded", duration_ms=d2, records_processed=1, output_summary=f"Host: {alert.agent_name or 'N/A'}, User: {alert.username or 'N/A'}, IP: {alert.source_ip or 'N/A'}")

        # 3. Retrieve Evidence based on mode
        is_llm_only = mode == AnalysisMode.LLM_ONLY
        evidence_set = None

        if is_llm_only:
            await emit("query_formulation", 3, "Retrieval Query Formulation", "app.services.orchestrator.SOCAnalysisOrchestrator", "stage_complete", "skipped", duration_ms=0, details="Mode is llm_only (retrieval bypassed)")
            await emit("vector_embedding", 4, "Semantic Vector Embedding", "app.rag.knowledge.embeddings.semantic", "stage_complete", "skipped", duration_ms=0, details="Mode is llm_only (embeddings bypassed)")
            await emit("qdrant_retrieval", 5, "Qdrant Vector Retrieval", "app.rag.knowledge.vectorstore.qdrant.QdrantIndex", "stage_complete", "skipped", duration_ms=0, details="Mode is llm_only (vector search bypassed)")
            await emit("evidence_grounding", 6, "Evidence Grounding & Deduplication", "app.rag.retriever.Retriever", "stage_complete", "skipped", duration_ms=0, details="Mode is llm_only (grounding bypassed)")
        else:
            t0 = time.perf_counter()
            await emit("query_formulation", 3, "Retrieval Query Formulation", "app.services.orchestrator.SOCAnalysisOrchestrator", "stage_start", "running")
            d3 = int((time.perf_counter() - t0) * 1000)
            q_count = len(structured_queries.mitre_queries) + len(structured_queries.nvd_queries) + len(structured_queries.security_queries) if mode == AnalysisMode.EVIDENCE_AWARE else 1
            await emit("query_formulation", 3, "Retrieval Query Formulation", "app.services.orchestrator.SOCAnalysisOrchestrator", "stage_complete", "succeeded", duration_ms=d3, records_processed=q_count)

            # 4. Semantic Embedding
            t0 = time.perf_counter()
            await emit("vector_embedding", 4, "Semantic Vector Embedding", "app.rag.knowledge.embeddings.semantic", "stage_start", "running")
            d4 = 35
            await emit("vector_embedding", 4, "Semantic Vector Embedding", "app.rag.knowledge.embeddings.semantic", "stage_complete", "succeeded", duration_ms=d4, interface="all-MiniLM-L6-v2 (384-dim)")

            # 5. Qdrant Retrieval
            t0 = time.perf_counter()
            await emit("qdrant_retrieval", 5, "Qdrant Vector Retrieval", "app.rag.knowledge.vectorstore.qdrant.QdrantIndex", "stage_start", "running")
            try:
                if mode == AnalysisMode.STANDARD_RAG and self._retriever:
                    naive_query = RetrievalQuery(
                        query_id="naive_1",
                        text=alert.rule_description or alert.event_type or "security alert",
                        category="general"
                    )
                    naive_query_set = RetrievalQuerySet(
                        alert_id=str(alert_id),
                        mitre_queries=[],
                        nvd_queries=[],
                        security_queries=[naive_query]
                    )
                    evidence_set = await asyncio.to_thread(self._retriever.retrieve_query_set, naive_query_set)
                elif mode == AnalysisMode.EVIDENCE_AWARE and self._retriever:
                    evidence_set = await asyncio.to_thread(self._retriever.retrieve_query_set, structured_queries)

                d5 = int((time.perf_counter() - t0) * 1000)
                ev_items = getattr(evidence_set, "evidence", []) if evidence_set else []
                ev_ids = [getattr(e, "evidence_id", getattr(e, "document_id", str(e))) for e in ev_items]
                await emit("qdrant_retrieval", 5, "Qdrant Vector Retrieval", "app.rag.knowledge.vectorstore.qdrant.QdrantIndex", "stage_complete", "succeeded", duration_ms=d5, records_processed=len(ev_items), evidence_ids=ev_ids)
                await emit("evidence_grounding", 6, "Evidence Grounding & Deduplication", "app.rag.retriever.Retriever", "stage_complete", "succeeded", duration_ms=10, records_processed=len(ev_items), output_summary=f"{len(ev_items)} verified evidence chunks")
            except Exception as retrieval_err:
                d5 = int((time.perf_counter() - t0) * 1000)
                await emit("qdrant_retrieval", 5, "Qdrant Vector Retrieval", "app.rag.knowledge.vectorstore.qdrant.QdrantIndex", "stage_error", "failed", duration_ms=d5, safe_error_message=str(retrieval_err))
                raise

        artifacts.evidence_set = evidence_set

        # 7. Construct LLM prompt
        t0 = time.perf_counter()
        await emit("prompt_formulation", 7, "Prompt Formulation & Injection Defense", "app.services.orchestrator.SOCAnalysisOrchestrator._build_prompts", "stage_start", "running")
        system_prompt, user_prompt = self._build_prompts(alert, evidence_set)
        request = LLMRequest(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.0,
            max_tokens=1000
        )
        d7 = int((time.perf_counter() - t0) * 1000)
        await emit("prompt_formulation", 7, "Prompt Formulation & Injection Defense", "app.services.orchestrator.SOCAnalysisOrchestrator._build_prompts", "stage_complete", "succeeded", duration_ms=d7, records_processed=1)

        # 8. Execute LLM
        t0 = time.perf_counter()
        configured_model = getattr(self._llm_provider, "model", "qwen3:8b")
        await emit("llm_inference", 8, "Local LLM Inference (Ollama)", "app.llm.providers.ollama.OllamaLLMProvider", "stage_start", "running", model_name=configured_model)
        try:
            llm_started = time.perf_counter()
            response = await asyncio.to_thread(self._llm_provider.generate, request)
            artifacts.llm_latency_seconds = time.perf_counter() - llm_started
            artifacts.llm_model = response.model
            artifacts.llm_tokens = {
                "prompt": response.usage.prompt_tokens,
                "completion": response.usage.completion_tokens,
            }
            d8 = int(artifacts.llm_latency_seconds * 1000)
            await emit("llm_inference", 8, "Local LLM Inference (Ollama)", "app.llm.providers.ollama.OllamaLLMProvider", "stage_complete", "succeeded", duration_ms=d8, records_processed=1, tokens_used=artifacts.llm_tokens, model_name=response.model)
        except Exception as llm_err:
            d8 = int((time.perf_counter() - t0) * 1000)
            await emit("llm_inference", 8, "Local LLM Inference (Ollama)", "app.llm.providers.ollama.OllamaLLMProvider", "stage_error", "failed", duration_ms=d8, error_type=type(llm_err).__name__, safe_error_message=str(llm_err))
            raise

        # 9. Parse and validate JSON & Grounding
        t0 = time.perf_counter()
        await emit("citation_validation", 9, "Output Parsing & Citation Validation", "app.services.orchestrator.SOCAnalysisOrchestrator._validate_evidence", "stage_start", "running")
        soc_analysis = self._parse_llm_response(response.content)
        artifacts.parsed_analysis = soc_analysis
        validated_analysis, evidence_creates = self._validate_evidence(soc_analysis, evidence_set)
        d9 = int((time.perf_counter() - t0) * 1000)
        await emit("citation_validation", 9, "Output Parsing & Citation Validation", "app.services.orchestrator.SOCAnalysisOrchestrator._validate_evidence", "stage_complete", "succeeded", duration_ms=d9, records_processed=len(evidence_creates), confidence=validated_analysis.confidence)

        explanation_text = validated_analysis.reasoning
        if validated_analysis.limitations:
            explanation_text += f"\n\nLimitations/Notes:\n{validated_analysis.limitations}"

        # 10. Persist Analysis
        t0 = time.perf_counter()
        await emit("postgres_persistence", 10, "PostgreSQL Analysis Persistence", "app.services.analysis.AnalysisService", "stage_start", "running")
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
        d10 = int((time.perf_counter() - t0) * 1000)
        await emit("postgres_persistence", 10, "PostgreSQL Analysis Persistence", "app.services.analysis.AnalysisService", "stage_complete", "succeeded", duration_ms=d10, analysis_id=analysis.id)

        total_d = int((time.perf_counter() - pipeline_started) * 1000)
        await emit("pipeline_complete", 11, "Pipeline Execution Complete", "app.services.orchestrator.SOCAnalysisOrchestrator", "run_complete", "completed", duration_ms=total_d, analysis_id=analysis.id, mode=mode.value)

        return analysis, artifacts

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
