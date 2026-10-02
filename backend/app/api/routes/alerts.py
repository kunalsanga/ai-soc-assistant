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
from app.services.analysis import AnalysisService
from app.services.exceptions import AlertNotFoundError, AnalysisNotFoundError
from app.wazuh.client import MockWazuhClient
from app.wazuh.schemas import SyncResult
from app.wazuh.service import AlertService

router = APIRouter()

# ---------------------------------------------------------------------------
# Alert reads
# ---------------------------------------------------------------------------

@router.get("/", response_model=List[AlertSchema])
async def get_alerts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Alert))
    alerts = result.scalars().all()
    return alerts


@router.get("/{alert_id}", response_model=AlertSchema)
async def get_alert(alert_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


# ---------------------------------------------------------------------------
# Analysis — POST  /{alert_id}/analyze
# ---------------------------------------------------------------------------

@router.post("/{alert_id}/analyze", response_model=AnalysisSchema)
async def analyze_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Create an Analysis for the given alert.

    The AI/LLM pipeline is not yet connected; this endpoint persists a
    'stub' analysis record so the full data flow (persist → retrieve → display)
    can be exercised end-to-end before the real LLM is integrated.

    When Kunal's LLM pipeline is ready, replace the stub AnalysisCreate below
    with the actual output from:
      normalized = await AlertService(...).get_normalized_alert(db, alert_id)
      context, queries = alert_service.get_security_context(normalized)
      evidence  = retriever.retrieve(queries)
      llm_result = await llm_client.analyze(normalized, evidence)
    """
    service = AnalysisService()
    try:
        analysis = await service.create_analysis(
            db=db,
            alert_id=alert_id,
            data=AnalysisCreate(
                summary="AI analysis pipeline not yet connected.",
                severity_assessment="pending",
                explanation=(
                    "This is a stub analysis created to validate the "
                    "end-to-end data flow. It will be replaced by real "
                    "LLM output in a future phase."
                ),
                recommended_investigation=(
                    "No automated recommendation available yet. "
                    "Analyst should review the alert manually."
                ),
                confidence="0.0",
                model_name="stub",
                analysis_type="stub",
            ),
        )
    except AlertNotFoundError as exc:
        raise HTTPException(status_code=404, detail=exc.message)

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
