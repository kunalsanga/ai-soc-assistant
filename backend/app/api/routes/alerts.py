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
