"""Security alert normalization and preprocessing (Kunal's ownership).

Phase 2: normalization (normalization.py)
Phase 3: preprocessing, context extraction, retrieval query construction.
"""
from .context import ContextExtractor
from .pipeline import SecurityContextPipeline
from .preprocessing import preprocess_alert
from .retrieval_queries import RetrievalQueryBuilder
from .schemas import (
    PreprocessedAlert,
    RetrievalQuery,
    RetrievalQuerySet,
    SecurityContext,
)

__all__ = [
    "ContextExtractor",
    "SecurityContextPipeline",
    "preprocess_alert",
    "RetrievalQueryBuilder",
    "PreprocessedAlert",
    "RetrievalQuery",
    "RetrievalQuerySet",
    "SecurityContext",
]
