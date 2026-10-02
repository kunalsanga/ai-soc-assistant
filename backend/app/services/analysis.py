"""Analysis CRUD service layer.

Responsibilities:
  - Create an Analysis record for an existing Alert.
  - Retrieve an Analysis by its own ID or by the parent Alert's ID.
  - Create and retrieve Evidence items that belong to an Analysis.
  - Enforce relationship integrity (alert must exist, analysis must exist).

This module is intentionally decoupled from HTTP (no FastAPI imports) and from
the AI/RAG pipeline (no LLM or Qdrant imports). The route layer translates
these service exceptions into appropriate HTTP responses.

When the LLM pipeline is ready, the route will:
  1. Call AlertService.get_normalized_alert() + get_security_context()
  2. Call the retriever and LLM client (Kunal's modules)
  3. Build an AnalysisCreate from the LLM output
  4. Call AnalysisService.create_analysis() to persist it
"""
from __future__ import annotations

import logging
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.alert import Alert, Analysis, Evidence
from app.schemas.alert import AnalysisCreate, EvidenceCreate
from app.services.exceptions import (
    AlertNotFoundError,
    AnalysisNotFoundError,
    InvalidAnalysisStateError,
)

logger = logging.getLogger(__name__)


class AnalysisService:
    """CRUD operations for the Analysis and Evidence tables.

    All methods are async and accept an AsyncSession injected by FastAPI's
    Depends(get_db). No session lifecycle management is done here — the caller
    (route or test) owns the session.
    """

    # ------------------------------------------------------------------
    # Analysis — create
    # ------------------------------------------------------------------

    async def create_analysis(
        self,
        db: AsyncSession,
        alert_id: int,
        data: AnalysisCreate,
    ) -> Analysis:
        """Create an Analysis record linked to an existing Alert.

        Args:
            db:       The async database session.
            alert_id: Primary key of the parent Alert row.
            data:     AnalysisCreate payload (all content fields are optional;
                      an analysis may start in a 'pending' state).

        Returns:
            The freshly committed Analysis ORM object (with .id populated).

        Raises:
            AlertNotFoundError: If no Alert with alert_id exists.
        """
        # Verify the parent alert exists before writing.
        alert_result = await db.execute(
            select(Alert).where(Alert.id == alert_id)
        )
        if alert_result.scalar_one_or_none() is None:
            raise AlertNotFoundError(
                f"Alert with id={alert_id} does not exist."
            )

        analysis = Analysis(
            alert_id=alert_id,
            summary=data.summary,
            severity_assessment=data.severity_assessment,
            explanation=data.explanation,
            recommended_investigation=data.recommended_investigation,
            confidence=data.confidence,
            model_name=data.model_name,
            analysis_type=data.analysis_type,
        )
        db.add(analysis)
        # Flush to get analysis.id assigned without committing the transaction
        # yet — allows evidence to reference it in the same transaction.
        await db.flush()

        # If evidence was provided inline, persist it now.
        if data.evidence:
            evidence_rows = self._build_evidence_rows(analysis.id, data.evidence)
            for row in evidence_rows:
                db.add(row)

        await db.commit()
        # Refresh to load server-side defaults (created_at) and relationships.
        await db.refresh(analysis)

        logger.info(
            "analysis_created analysis_id=%d alert_id=%d evidence_count=%d",
            analysis.id,
            alert_id,
            len(data.evidence),
        )
        return analysis

    # ------------------------------------------------------------------
    # Analysis — read
    # ------------------------------------------------------------------

    async def get_analysis_by_id(
        self,
        db: AsyncSession,
        analysis_id: int,
        load_evidence: bool = True,
    ) -> Analysis:
        """Fetch a single Analysis by its primary key.

        Args:
            db:           The async database session.
            analysis_id:  Primary key of the Analysis row.
            load_evidence: If True (default), eagerly load the evidence
                          relationship so callers don't need a second query.

        Returns:
            The Analysis ORM object.

        Raises:
            AnalysisNotFoundError: If no Analysis with analysis_id exists.
        """
        stmt = select(Analysis).where(Analysis.id == analysis_id)
        if load_evidence:
            stmt = stmt.options(selectinload(Analysis.evidence))

        result = await db.execute(stmt)
        analysis = result.scalar_one_or_none()
        if analysis is None:
            raise AnalysisNotFoundError(
                f"Analysis with id={analysis_id} does not exist."
            )
        return analysis

    async def get_analyses_for_alert(
        self,
        db: AsyncSession,
        alert_id: int,
        load_evidence: bool = True,
    ) -> List[Analysis]:
        """Return all Analysis records for a given Alert, newest first.

        An alert may have more than one analysis (e.g., re-runs or different
        model versions). The list is ordered by created_at DESC so the most
        recent result comes first.

        Args:
            db:           The async database session.
            alert_id:     Primary key of the parent Alert.
            load_evidence: If True (default), eagerly load the evidence
                          relationship on each Analysis.

        Returns:
            List of Analysis ORM objects (may be empty if none exist).

        Raises:
            AlertNotFoundError: If the parent Alert itself does not exist.
        """
        # Verify the alert exists so callers get a meaningful error when
        # providing a wrong ID, rather than a silent empty list.
        alert_result = await db.execute(
            select(Alert).where(Alert.id == alert_id)
        )
        if alert_result.scalar_one_or_none() is None:
            raise AlertNotFoundError(
                f"Alert with id={alert_id} does not exist."
            )

        stmt = (
            select(Analysis)
            .where(Analysis.alert_id == alert_id)
            .order_by(Analysis.created_at.desc())
        )
        if load_evidence:
            stmt = stmt.options(selectinload(Analysis.evidence))

        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_latest_analysis_for_alert(
        self,
        db: AsyncSession,
        alert_id: int,
        load_evidence: bool = True,
    ) -> Optional[Analysis]:
        """Return the most recent Analysis for a given Alert, or None.

        Convenience wrapper over get_analyses_for_alert() for the common case
        where only the latest result is needed (e.g., the alert detail page).

        Raises:
            AlertNotFoundError: If the parent Alert does not exist.
        """
        analyses = await self.get_analyses_for_alert(
            db, alert_id, load_evidence=load_evidence
        )
        return analyses[0] if analyses else None

    # ------------------------------------------------------------------
    # Evidence — create
    # ------------------------------------------------------------------

    async def add_evidence(
        self,
        db: AsyncSession,
        analysis_id: int,
        evidence_items: List[EvidenceCreate],
    ) -> List[Evidence]:
        """Append Evidence items to an existing Analysis.

        This method is separate from create_analysis() to support the future
        flow where the LLM pipeline runs asynchronously and evidence is
        attached after the initial Analysis record is created.

        Args:
            db:             The async database session.
            analysis_id:    Primary key of the parent Analysis.
            evidence_items: One or more EvidenceCreate payloads.

        Returns:
            List of the newly created Evidence ORM objects.

        Raises:
            AnalysisNotFoundError:    If no Analysis with analysis_id exists.
            InvalidAnalysisStateError: If evidence_items is empty.
        """
        if not evidence_items:
            raise InvalidAnalysisStateError(
                "evidence_items must not be empty; pass at least one item."
            )

        # Verify the parent analysis exists.
        analysis_result = await db.execute(
            select(Analysis).where(Analysis.id == analysis_id)
        )
        if analysis_result.scalar_one_or_none() is None:
            raise AnalysisNotFoundError(
                f"Analysis with id={analysis_id} does not exist."
            )

        rows = self._build_evidence_rows(analysis_id, evidence_items)
        for row in rows:
            db.add(row)
        await db.commit()

        # Refresh each row so server-assigned IDs are available.
        for row in rows:
            await db.refresh(row)

        logger.info(
            "evidence_added analysis_id=%d count=%d",
            analysis_id,
            len(rows),
        )
        return rows

    # ------------------------------------------------------------------
    # Evidence — read
    # ------------------------------------------------------------------

    async def get_evidence_for_analysis(
        self,
        db: AsyncSession,
        analysis_id: int,
    ) -> List[Evidence]:
        """Return all Evidence items for a given Analysis, by relevance score.

        Args:
            db:          The async database session.
            analysis_id: Primary key of the parent Analysis.

        Returns:
            List of Evidence ORM objects ordered by relevance_score DESC.

        Raises:
            AnalysisNotFoundError: If no Analysis with analysis_id exists.
        """
        analysis_result = await db.execute(
            select(Analysis).where(Analysis.id == analysis_id)
        )
        if analysis_result.scalar_one_or_none() is None:
            raise AnalysisNotFoundError(
                f"Analysis with id={analysis_id} does not exist."
            )

        result = await db.execute(
            select(Evidence)
            .where(Evidence.analysis_id == analysis_id)
            .order_by(Evidence.relevance_score.desc())
        )
        return list(result.scalars().all())

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _build_evidence_rows(
        analysis_id: int,
        items: List[EvidenceCreate],
    ) -> List[Evidence]:
        """Convert EvidenceCreate payloads to Evidence ORM objects."""
        return [
            Evidence(
                analysis_id=analysis_id,
                source=item.source,
                document_id=item.document_id,
                title=item.title,
                content=item.content,
                relevance_score=item.relevance_score,
                citation=item.citation,
            )
            for item in items
        ]
