"""Analysis API routes.

Endpoints:
  GET /{analysis_id}           Get a single analysis (with its evidence).
  GET /{analysis_id}/evidence  List evidence records for an analysis.

Read-only: analyses are created exclusively through
POST /api/v1/alerts/{alert_id}/analyze (the orchestrator pipeline).
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models.alert import Analysis
from app.schemas.alert import AnalysisSchema, EvidenceSchema
from app.services.analysis import AnalysisService
from app.services.exceptions import AnalysisNotFoundError

router = APIRouter()


@router.get("", response_model=List[AnalysisSchema])
@router.get("/", response_model=List[AnalysisSchema])
async def list_analyses(
    alert_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """List persisted analyses, newest first, with optional alert_id filter."""
    stmt = (
        select(Analysis)
        .options(selectinload(Analysis.evidence))
        .order_by(Analysis.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if alert_id is not None:
        stmt = stmt.where(Analysis.alert_id == alert_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{analysis_id}", response_model=AnalysisSchema)
async def get_analysis(analysis_id: int, db: AsyncSession = Depends(get_db)):
    service = AnalysisService()
    try:
        return await service.get_analysis_by_id(db, analysis_id, load_evidence=True)
    except AnalysisNotFoundError as exc:
        raise HTTPException(status_code=404, detail=exc.message)


@router.get("/{analysis_id}/evidence", response_model=List[EvidenceSchema])
async def get_analysis_evidence(analysis_id: int, db: AsyncSession = Depends(get_db)):
    service = AnalysisService()
    try:
        return await service.get_evidence_for_analysis(db, analysis_id)
    except AnalysisNotFoundError as exc:
        raise HTTPException(status_code=404, detail=exc.message)
