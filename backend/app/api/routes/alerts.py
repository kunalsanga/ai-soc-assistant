from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.database import get_db
from app.db.models.alert import Alert
from app.schemas.alert import Alert as AlertSchema, AnalysisPlaceholder
from app.wazuh.client import MockWazuhClient
from app.wazuh.schemas import SyncResult
from app.wazuh.service import AlertService

router = APIRouter()

@router.get("/", response_model=List[AlertSchema])
async def get_alerts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Alert))
    alerts = result.scalars().all()
    # In a real scenario, we might sync with Wazuh here or a background worker would
    return alerts

@router.get("/{alert_id}", response_model=AlertSchema)
async def get_alert(alert_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert

@router.post("/{alert_id}/analyze", response_model=AnalysisPlaceholder)
async def analyze_alert(alert_id: int, db: AsyncSession = Depends(get_db)):
    # Placeholder for the RAG + LLM pipeline (implemented in later phases)
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    return AnalysisPlaceholder(
        status="pending",
        message="AI analysis pipeline not connected yet"
    )

@router.post("/sync", response_model=SyncResult)
async def sync_alerts(db: AsyncSession = Depends(get_db)):
    """Sync alerts from the configured Wazuh client (mock or real) into the DB.

    Uses the AlertService: fetch -> normalize -> dedupe -> persist.
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
