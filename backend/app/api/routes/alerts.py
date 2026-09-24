from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.database import get_db
from app.db.models.alert import Alert
from app.schemas.alert import Alert as AlertSchema, AnalysisPlaceholder
from app.wazuh.client import get_wazuh_client, BaseWazuhClient

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
    # Placeholder for the RAG + LLM pipeline
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    return AnalysisPlaceholder(
        status="pending",
        message="AI analysis pipeline not connected yet"
    )

# Development endpoint to sync mock alerts to DB
@router.post("/sync-mock")
async def sync_mock_alerts(db: AsyncSession = Depends(get_db), client: BaseWazuhClient = Depends(get_wazuh_client)):
    mock_alerts = await client.get_alerts()
    synced_count = 0
    for mock_alert in mock_alerts:
        result = await db.execute(select(Alert).where(Alert.external_alert_id == mock_alert.external_alert_id))
        existing = result.scalar_one_or_none()
        if not existing:
            new_alert = Alert(**mock_alert.model_dump())
            db.add(new_alert)
            synced_count += 1
    
    await db.commit()
    return {"status": "ok", "synced_count": synced_count}
