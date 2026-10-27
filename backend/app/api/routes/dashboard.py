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
async def dashboard_stats(
    source: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    from app.datasources.manager import DataSourceManager

    source_type = DataSourceManager.normalize_source(source)

    # --- Alert aggregates scoped to source ------------------------------------
    count_stmt = DataSourceManager.filter_query(select(func.count(Alert.id)), source_type)
    alert_count = (await db.execute(count_stmt)).scalar_one()

    sev_stmt = DataSourceManager.filter_query(
        select(Alert.severity, func.count(Alert.id)).group_by(Alert.severity),
        source_type,
    )
    severity_rows = (await db.execute(sev_stmt)).all()
    severity_distribution: Dict[str, int] = {
        "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0,
    }
    for severity, count in severity_rows:
        if severity is None:
            continue
        severity_distribution[_severity_band(int(severity))] += int(count)

    # --- Analysis / Evidence aggregates scoped to alerts of this source -------
    analysis_count_stmt = (
        select(func.count(Analysis.id))
        .join(Alert, Analysis.alert_id == Alert.id)
    )
    analysis_count_stmt = DataSourceManager.filter_query(analysis_count_stmt, source_type)
    analysis_count = (await db.execute(analysis_count_stmt)).scalar_one()

    evidence_count_stmt = (
        select(func.count(Evidence.id))
        .join(Analysis, Evidence.analysis_id == Analysis.id)
        .join(Alert, Analysis.alert_id == Alert.id)
    )
    evidence_count_stmt = DataSourceManager.filter_query(evidence_count_stmt, source_type)
    evidence_count = (await db.execute(evidence_count_stmt)).scalar_one()

    analyses_by_type_stmt = (
        select(Analysis.analysis_type, func.count(Analysis.id))
        .join(Alert, Analysis.alert_id == Alert.id)
        .group_by(Analysis.analysis_type)
    )
    analyses_by_type_stmt = DataSourceManager.filter_query(analyses_by_type_stmt, source_type)
    analyses_by_type_rows = (await db.execute(analyses_by_type_stmt)).all()
    analyses_by_type = {str(t or "unknown"): int(c) for t, c in analyses_by_type_rows}

    # --- Recent analyses (latest 5, with alert reference) ---------------------
    recent_stmt = (
        select(Analysis)
        .join(Alert, Analysis.alert_id == Alert.id)
        .order_by(Analysis.created_at.desc())
        .limit(5)
    )
    recent_stmt = DataSourceManager.filter_query(recent_stmt, source_type)
    recent_rows = (await db.execute(recent_stmt)).scalars().all()
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
        "data_source": source_type.value,
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

