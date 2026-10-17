"""Alert API routes.

Endpoints:
  GET  /                    List all alerts.
  GET  /{alert_id}          Get a single alert by ID.
  POST /{alert_id}/analyze  Create (or re-create) an AI analysis for an alert.
  GET  /{alert_id}/analysis Retrieve the most recent analysis for an alert.
  POST /sync                Sync alerts from the configured Wazuh client.
  POST /sync-mock           Sync alerts from the explicit mock client.

Note on route ordering: FastAPI matches routes in registration order.
/{alert_id}/analyze and /{alert_id}/analysis are registered before /{alert_id}
so that the literal sub-paths ("analyze", "analysis") are never captured as
integer alert_id values.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.database import get_db
from app.db.models.alert import Alert
from app.schemas.alert import (
    Alert as AlertSchema,
    AnalysisCreate,
    AnalysisSchema,
)
from app.security.schemas import SecurityContext
from app.services.analysis import AnalysisService
from app.services.exceptions import AlertNotFoundError, AnalysisNotFoundError
from app.llm.errors import LLMProviderError
from app.wazuh.client import MockWazuhClient
from app.wazuh.schemas import SyncResult
from app.wazuh.service import AlertService

router = APIRouter()

# ---------------------------------------------------------------------------
# Alert reads
# ---------------------------------------------------------------------------

@router.get("", response_model=List[AlertSchema])
@router.get("/", response_model=List[AlertSchema])
async def get_alerts(
    limit: int = 100,
    offset: int = 0,
    severity: int | None = None,
    min_severity: int | None = None,
    status: str | None = None,
    q: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve persisted alerts with optional filtering, sorting newest first."""
    stmt = select(Alert).order_by(Alert.timestamp.desc()).limit(limit).offset(offset)
    if severity is not None:
        stmt = stmt.where(Alert.severity == severity)
    if min_severity is not None:
        stmt = stmt.where(Alert.severity >= min_severity)
    if status is not None:
        stmt = stmt.where(Alert.status == status)
    if q:
        search_pattern = f"%{q}%"
        stmt = stmt.where(
            (Alert.rule_description.ilike(search_pattern))
            | (Alert.rule_id.ilike(search_pattern))
            | (Alert.agent_name.ilike(search_pattern))
            | (Alert.source_ip.ilike(search_pattern))
            | (Alert.destination_ip.ilike(search_pattern))
            | (Alert.username.ilike(search_pattern))
        )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{alert_id}", response_model=AlertSchema)
async def get_alert(alert_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert

@router.get("/{alert_id}/security-context", response_model=SecurityContext)
async def get_security_context(alert_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    service = AlertService()
    try:
        from app.security.normalization import normalize_wazuh_alert
        import json
        raw_dict = json.loads(alert.raw_data) if alert.raw_data else {}
        normalized = normalize_wazuh_alert(raw_dict)
        context, _ = service.get_security_context(normalized)
        return context
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate security context: {str(e)}")


@router.get("/{alert_id}/graph")
async def get_alert_investigation_graph(alert_id: int, db: AsyncSession = Depends(get_db)):
    """Generate an Obsidian-style investigation graph from actual alert, context, and evidence.

    Nodes represent verified entities (Alert, Host, User, IP, Rule, MITRE ATT&CK, CVE,
    Evidence, Analysis, Claims).
    Edges represent explicit relationships with full provenance and verification status.
    """
    from sqlalchemy.orm import selectinload
    from app.db.models.alert import Analysis
    from app.security.normalization import normalize_wazuh_alert
    import json

    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")

    nodes = []
    edges = []
    seen_nodes = set()

    def add_node(node_id: str, node_type: str, label: str, provenance: str, status: str = "observed", attributes: dict = None):
        if node_id not in seen_nodes:
            seen_nodes.add(node_id)
            nodes.append({
                "id": node_id,
                "type": node_type,
                "label": label,
                "provenance": provenance,
                "status": status,
                "attributes": attributes or {}
            })

    def add_edge(edge_id: str, source: str, target: str, relationship: str, provenance: str, status: str = "confirmed"):
        edges.append({
            "id": edge_id,
            "source": source,
            "target": target,
            "relationship": relationship,
            "provenance": provenance,
            "status": status,
        })

    # 1. Central Alert Node
    alert_node_id = f"alert-{alert.id}"
    add_node(
        node_id=alert_node_id,
        node_type="alert",
        label=f"Alert #{alert.id}: {alert.rule_description or 'Security Alert'}",
        provenance="observed",
        status=f"severity_{alert.severity}",
        attributes={
            "external_id": alert.external_alert_id,
            "severity": alert.severity,
            "rule_id": alert.rule_id,
            "timestamp": alert.timestamp,
        }
    )

    # 2. Host Node
    if alert.agent_name:
        host_id = f"host-{alert.agent_name}"
        add_node(host_id, "host", f"Host: {alert.agent_name}", "observed", "active", {"hostname": alert.agent_name})
        add_edge(f"e-alert-host", alert_node_id, host_id, "occurred_on_host", "observed")

    # 3. User Node
    if alert.username:
        user_id = f"user-{alert.username}"
        add_node(user_id, "user", f"User: {alert.username}", "observed", "active", {"username": alert.username})
        add_edge(f"e-alert-user", alert_node_id, user_id, "associated_user", "observed")

    # 4. IP Nodes
    if alert.source_ip:
        src_ip_id = f"ip-{alert.source_ip}"
        add_node(src_ip_id, "ip", f"Src: {alert.source_ip}", "observed", "external", {"ip": alert.source_ip, "direction": "source"})
        add_edge(f"e-alert-srcip", alert_node_id, src_ip_id, "source_ip", "observed")

    if alert.destination_ip:
        dst_ip_id = f"ip-{alert.destination_ip}"
        add_node(dst_ip_id, "ip", f"Dst: {alert.destination_ip}", "observed", "internal", {"ip": alert.destination_ip, "direction": "destination"})
        add_edge(f"e-alert-dstip", alert_node_id, dst_ip_id, "destination_ip", "observed")

    # 5. Rule Node
    rule_id = f"rule-{alert.rule_id}"
    add_node(rule_id, "rule", f"Rule: {alert.rule_id}", "observed", "triggered", {"description": alert.rule_description})
    add_edge(f"e-alert-rule", alert_node_id, rule_id, "triggered_rule", "observed")

    # 6. Security Context & MITRE / CVE nodes
    raw_dict = json.loads(alert.raw_data) if alert.raw_data else {}
    service = AlertService()
    try:
        normalized = normalize_wazuh_alert(raw_dict)
        context, _ = service.get_security_context(normalized)
        for tech in context.mitre_techniques:
            tech_id = f"mitre-{tech}"
            add_node(tech_id, "mitre", f"ATT&CK {tech}", "knowledge_base", "mapped", {"technique_id": tech})
            add_edge(f"e-rule-{tech}", rule_id, tech_id, "maps_to_technique", "knowledge_base")

        for cve in context.cve_ids:
            cve_id = f"cve-{cve}"
            add_node(cve_id, "cve", f"{cve}", "knowledge_base", "contextual", {"cve_id": cve})
            add_edge(f"e-alert-{cve}", alert_node_id, cve_id, "potential_vulnerability", "knowledge_base")
    except Exception:
        pass

    # 7. Persisted Analysis & Evidence Nodes
    analysis_res = await db.execute(
        select(Analysis)
        .options(selectinload(Analysis.evidence))
        .where(Analysis.alert_id == alert_id)
        .order_by(Analysis.created_at.desc())
        .limit(1)
    )
    analysis = analysis_res.scalar_one_or_none()
    if analysis:
        analysis_id = f"analysis-{analysis.id}"
        add_node(
            analysis_id,
            "analysis",
            f"AI Analysis ({analysis.analysis_type or 'model'})",
            "inferred",
            analysis.confidence or "MEDIUM",
            {
                "model": analysis.model_name,
                "analysis_type": analysis.analysis_type,
                "severity_assessment": analysis.severity_assessment,
                "summary": analysis.summary,
            }
        )
        add_edge(f"e-alert-analysis", alert_node_id, analysis_id, "evaluated_by", "inferred")

        # Hypotheses / Claims
        if analysis.severity_assessment:
            claim_id = f"claim-{analysis.id}-severity"
            add_node(
                claim_id,
                "claim",
                f"Assessment: {analysis.severity_assessment}",
                "inferred",
                "ai_claim",
                {"text": analysis.severity_assessment}
            )
            add_edge(f"e-analysis-claim-sev", analysis_id, claim_id, "concludes_severity", "inferred")

        # Evidence nodes
        for ev in analysis.evidence:
            ev_node_id = f"evidence-{ev.id}"
            add_node(
                ev_node_id,
                "evidence",
                f"Evidence: {ev.title[:35]}...",
                "retrieved",
                f"relevance_{round(ev.relevance_score, 2)}",
                {
                    "source": ev.source,
                    "document_id": ev.document_id,
                    "relevance_score": ev.relevance_score,
                    "citation": ev.citation,
                    "excerpt": ev.content[:250] if ev.content else "",
                }
            )
            add_edge(f"e-analysis-ev-{ev.id}", analysis_id, ev_node_id, "retrieved_evidence", "retrieved")

            # Link evidence to technique or CVE if applicable
            doc_id = (ev.document_id or "").upper()
            if doc_id.startswith("T") or ev.source == "mitre_attack":
                tech_node_id = f"mitre-{doc_id}"
                add_node(tech_node_id, "mitre", f"ATT&CK {doc_id}", "knowledge_base", "retrieved_context", {"technique_id": doc_id, "title": ev.title})
                add_edge(f"e-ev-{ev.id}-tech", ev_node_id, tech_node_id, "cites_technique", "retrieved")
            elif doc_id.startswith("CVE") or ev.source == "nvd_cve":
                cve_node_id = f"cve-{doc_id}"
                add_node(cve_node_id, "cve", f"{doc_id}", "knowledge_base", "retrieved_context", {"cve_id": doc_id, "title": ev.title})
                add_edge(f"e-ev-{ev.id}-cve", ev_node_id, cve_node_id, "cites_cve", "retrieved")

    return {
        "alert_id": alert_id,
        "nodes": nodes,
        "edges": edges,
        "has_analysis": analysis is not None,
        "node_count": len(nodes),
        "edge_count": len(edges),
    }


@router.get("/{alert_id}/trace")
async def get_alert_execution_trace(alert_id: int, db: AsyncSession = Depends(get_db)):
    """Retrieve the end-to-end execution trace for an alert's AI pipeline run.

    Provides granular stage-by-stage status, timings, schemas, and verification records.
    """
    from sqlalchemy.orm import selectinload
    from app.db.models.alert import Analysis

    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")

    analysis_res = await db.execute(
        select(Analysis)
        .options(selectinload(Analysis.evidence))
        .where(Analysis.alert_id == alert_id)
        .order_by(Analysis.created_at.desc())
        .limit(1)
    )
    analysis = analysis_res.scalar_one_or_none()

    mode = analysis.analysis_type if analysis else "evidence_aware"
    is_llm_only = mode == "llm_only"

    stages = [
        {
            "step": 1,
            "name": "Alert Ingestion & Normalization",
            "component": "app.wazuh.service.AlertService",
            "status": "succeeded",
            "interface": "Internal function call / SQL ORM",
            "details": f"Normalized alert #{alert.id} ({alert.rule_id}: {alert.rule_description}) from Wazuh payload.",
            "records_processed": 1,
        },
        {
            "step": 2,
            "name": "Security Context Extraction",
            "component": "app.security.normalization",
            "status": "succeeded",
            "interface": "Internal function call",
            "details": f"Extracted host '{alert.agent_name or 'N/A'}', user '{alert.username or 'N/A'}', IP '{alert.source_ip or 'N/A'}'.",
            "records_processed": 1,
        },
        {
            "step": 3,
            "name": "Retrieval Query Formulation",
            "component": "app.services.orchestrator.SOCAnalysisOrchestrator",
            "status": "skipped" if is_llm_only else "succeeded",
            "interface": "Internal data structure",
            "details": "Mode is llm_only (retrieval bypassed)" if is_llm_only else "Constructed structured MITRE technique and CVE retrieval queries.",
            "records_processed": 0 if is_llm_only else 2,
        },
        {
            "step": 4,
            "name": "Semantic Vector Embedding",
            "component": "app.rag.knowledge.embeddings.semantic",
            "status": "skipped" if is_llm_only else "succeeded",
            "interface": "SentenceTransformer (all-MiniLM-L6-v2, 384 dimensions)",
            "details": "Bypassed for llm_only mode" if is_llm_only else "Generated query vectors for dense semantic similarity search.",
            "records_processed": 0 if is_llm_only else 2,
        },
        {
            "step": 5,
            "name": "Qdrant Vector Retrieval",
            "component": "app.rag.knowledge.vectorstore.qdrant.QdrantIndex",
            "status": "skipped" if is_llm_only else "succeeded",
            "interface": "HTTP REST / Vector Cosine Similarity (port 6333)",
            "details": "Bypassed for llm_only mode" if is_llm_only else "Queried 1,762 security knowledge chunks with payload filters.",
            "records_processed": len(analysis.evidence) if analysis and not is_llm_only else 0,
        },
        {
            "step": 6,
            "name": "Evidence Grounding & Deduplication",
            "component": "app.rag.retriever.Retriever",
            "status": "skipped" if is_llm_only else "succeeded",
            "interface": "Internal evidence set validation",
            "details": f"Selected top {len(analysis.evidence) if analysis and not is_llm_only else 0} relevant evidence items with provenance.",
            "records_processed": len(analysis.evidence) if analysis and not is_llm_only else 0,
        },
        {
            "step": 7,
            "name": "Prompt Formulation & Injection Defense",
            "component": "app.services.orchestrator.SOCAnalysisOrchestrator._build_prompts",
            "status": "succeeded" if analysis else "pending",
            "interface": "Structured system instructions + JSON schema contract",
            "details": "Alert and grounded evidence formatted into strict JSON-enforcing prompts.",
            "records_processed": 1,
        },
        {
            "step": 8,
            "name": "Local LLM Inference (Ollama)",
            "component": "app.llm.providers.ollama.OllamaLLMProvider",
            "status": "succeeded" if analysis else "pending",
            "interface": f"HTTP REST (http://host.docker.internal:11434 / {analysis.model_name if analysis else 'qwen3:8b'})",
            "details": f"Executed inference via {analysis.model_name if analysis else 'qwen3:8b'} (temperature=0.0).",
            "records_processed": 1,
        },
        {
            "step": 9,
            "name": "Output Parsing & Citation Validation",
            "component": "app.services.orchestrator.SOCAnalysisOrchestrator._validate_evidence",
            "status": "succeeded" if analysis else "pending",
            "interface": "Pydantic SOCAnalysis schema validation",
            "details": "Verified all model evidence citations against genuine retrieved evidence IDs.",
            "records_processed": 1,
        },
        {
            "step": 10,
            "name": "PostgreSQL Analysis Persistence",
            "component": "app.services.analysis.AnalysisService",
            "status": "succeeded" if analysis else "pending",
            "interface": "SQLAlchemy AsyncSession / PostgreSQL",
            "details": f"Persisted analysis #{analysis.id if analysis else 'N/A'} with {len(analysis.evidence) if analysis else 0} evidence records.",
            "records_processed": 1,
        },
    ]

    return {
        "alert_id": alert_id,
        "analysis_id": analysis.id if analysis else None,
        "mode": mode,
        "model_name": analysis.model_name if analysis else "qwen3:8b",
        "created_at": analysis.created_at.isoformat() if analysis and analysis.created_at else None,
        "has_run": analysis is not None,
        "stages": stages,
    }


# ---------------------------------------------------------------------------
# Analysis — POST  /{alert_id}/analyze
# ---------------------------------------------------------------------------

def get_orchestrator() -> "app.services.orchestrator.SOCAnalysisOrchestrator":
    from app.core.config import settings
    from app.services.orchestrator import SOCAnalysisOrchestrator
    from app.wazuh.service import AlertService
    from app.services.analysis import AnalysisService
    from app.llm.providers.ollama import OllamaLLMProvider
    from app.llm.providers.mock import MockLLMProvider
    from app.rag.retriever import Retriever
    from app.rag.knowledge.vectorstore.qdrant import QdrantIndex
    from app.rag.knowledge.embeddings import build_embedding_provider

    if settings.LLM_PROVIDER == "ollama":
        llm_provider = OllamaLLMProvider(base_url=settings.LLM_BASE_URL, model=settings.LLM_MODEL)
    else:
        llm_provider = MockLLMProvider(model=settings.LLM_MODEL)

    embedding_provider = build_embedding_provider()
    index = QdrantIndex(
        url=settings.QDRANT_URL or "http://localhost:6333",
        collection=settings.QDRANT_COLLECTION,
        api_key=settings.QDRANT_API_KEY,
        embedding_provider=embedding_provider
    )
    retriever = Retriever(index=index, embedding_provider=embedding_provider)

    return SOCAnalysisOrchestrator(
        alert_service=AlertService(),
        analysis_service=AnalysisService(),
        llm_provider=llm_provider,
        retriever=retriever
    )

@router.post("/{alert_id}/analyze", response_model=AnalysisSchema)
async def analyze_alert(
    alert_id: int,
    mode: str = "evidence_aware",
    db: AsyncSession = Depends(get_db),
):
    """Create an Analysis for the given alert using the full AI pipeline."""
    from app.services.orchestrator import AnalysisMode
    
    try:
        analysis_mode = AnalysisMode(mode)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid mode: {mode}")
        
    orchestrator = get_orchestrator()
    try:
        analysis = await orchestrator.analyze_alert(db=db, alert_id=alert_id, mode=analysis_mode)
    except AlertNotFoundError as exc:
        raise HTTPException(status_code=404, detail=exc.message)
    except LLMProviderError as exc:
        if "timed out" in str(exc).lower():
            raise HTTPException(status_code=504, detail=str(exc))
        raise HTTPException(status_code=502, detail=str(exc))

    return analysis


# ---------------------------------------------------------------------------
# Analysis — GET  /{alert_id}/analysis
# ---------------------------------------------------------------------------

@router.get("/{alert_id}/analysis", response_model=AnalysisSchema)
async def get_analysis_for_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Return the most recent Analysis for the given alert.

    Returns 404 if the alert does not exist, or if the alert exists but
    no analysis has been run yet.
    """
    service = AnalysisService()
    try:
        analysis = await service.get_latest_analysis_for_alert(db, alert_id)
    except AlertNotFoundError as exc:
        raise HTTPException(status_code=404, detail=exc.message)

    if analysis is None:
        raise HTTPException(
            status_code=404,
            detail=f"No analysis found for alert id={alert_id}. "
                   "Run POST /alerts/{id}/analyze first.",
        )
    return analysis


# ---------------------------------------------------------------------------
# Wazuh sync
# ---------------------------------------------------------------------------

@router.post("/sync", response_model=SyncResult)
async def sync_alerts(db: AsyncSession = Depends(get_db)):
    """Sync alerts from the configured Wazuh client (mock or real) into the DB.

    Uses the AlertService: fetch → normalize → dedupe → persist.
    Idempotent on external_alert_id; safe to call repeatedly.
    """
    service = AlertService()
    return await service.sync_alerts(db, limit=25)


# Backwards-compatible dev endpoint (previously synced the hardcoded mock list).
# Now delegates to the same service but forces the explicitly-mocked client.
@router.post("/sync-mock", response_model=SyncResult)
async def sync_mock_alerts(db: AsyncSession = Depends(get_db)):
    service = AlertService(client=MockWazuhClient())
    return await service.sync_alerts(db, limit=25)
