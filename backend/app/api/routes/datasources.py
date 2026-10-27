"""Data source management API endpoints."""
from __future__ import annotations

import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.datasources.manager import DataSourceManager
from app.datasources.schemas import DataSourcesSummary, DataSourceType
from app.db.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=DataSourcesSummary)
@router.get("/", response_model=DataSourcesSummary)
async def list_data_sources(
    active: Optional[str] = Query(None, description="Active source to inspect (demo, live_wazuh, dataset_replay)"),
    db: AsyncSession = Depends(get_db),
) -> DataSourcesSummary:
    """Return available data sources with their real connectivity and record counts."""
    selected = DataSourceManager.normalize_source(active) if active else None
    return await DataSourceManager.get_source_summary(db, selected)
