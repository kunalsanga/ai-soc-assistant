"""Dashboard statistics route backed by real database aggregates.

GET /dashboard/stats returns actual counts (SQL aggregates, not downloads),
severity distribution, recent persisted analyses, evidence count, and the
real connectivity state of each external service.
"""
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models.alert import Alert, Analysis, Evidence
from app.services.health import check_services

router = APIRouter()


def _severity_band(sev: int) -> str:
    if sev >= 12:
        return "critical"
    if sev >= 8:
        return "high"
    if sev >= 5:
        return "medium"
    if sev >= 2:
        return "low"
    return "info"


@router.get("/stats")
async def dashboard_stats(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    # --- Alert aggregates ----------------------------------------------------
    alert_count = (await db.execute(select(func.count(Alert.id)))).scalar_one()

    severity_rows = (
        await db.execute(
            select(Alert.severity, func.count(Alert.id))
            .group_by(Alert.severity)
        )
    ).all()
    severity_distribution: Dict[str, int] = {
        "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0,
    }
    for severity, count in severity_rows:
        if severity is None:
            continue
        severity_distribution[_severity_band(int(severity))] += int(count)

    # --- Analysis / Evidence aggregates --------------------------------------
    analysis_count = (await db.execute(select(func.count(Analysis.id)))).scalar_one()
    evidence_count = (await db.execute(select(func.count(Evidence.id)))).scalar_one()

    analyses_by_type_rows = (
        await db.execute(
            select(Analysis.analysis_type, func.count(Analysis.id))
            .group_by(Analysis.analysis_type)
        )
    ).all()
    analyses_by_type = {str(t or "unknown"): int(c) for t, c in analyses_by_type_rows}

    # --- Recent analyses (latest 5, with alert reference) ---------------------
    recent_rows = (
        await db.execute(
            select(Analysis)
            .order_by(Analysis.created_at.desc())
            .limit(5)
        )
    ).scalars().all()
    recent: List[Dict[str, Any]] = [
        {
            "id": a.id,
            "alert_id": a.alert_id,
            "summary": a.summary,
            "severity_assessment": a.severity_assessment,
            "analysis_type": a.analysis_type,
            "model_name": a.model_name,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in recent_rows
    ]

    # --- Real service health (bounded timeouts) -------------------------------
    services = await check_services()

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "alerts": {
            "total": int(alert_count),
            "severity_distribution": severity_distribution,
        },
        "analyses": {
            "total": int(analysis_count),
            "by_mode": analyses_by_type,
            "recent": recent,
        },
        "evidence": {"total": int(evidence_count)},
        "services": services,
    }
