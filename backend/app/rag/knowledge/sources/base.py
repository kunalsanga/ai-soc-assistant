"""KnowledgeSource abstraction (spec Step 3).

A source adapter owns exactly two things:
1. loading raw records from its authoritative origin (file, API, etc.)
2. normalizing each raw record into the common KnowledgeDocument model

Everything downstream (chunking/embedding/indexing) is source-agnostic.
Adapters never invent fields, never execute content, and never mutate the
raw records they read.
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Tuple

from app.rag.knowledge.schemas import KnowledgeDocument

logger = logging.getLogger(__name__)


class KnowledgeSourceError(Exception):
    """Raised when a knowledge source itself fails (unreadable file, bad bundle)."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class KnowledgeSource(ABC):
    """Base class for one authoritative knowledge source."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Stable source name, e.g. 'mitre_attack'."""

    @abstractmethod
    def load_raw(self) -> List[Dict[str, Any]]:
        """Load raw source records. Must not raise on individual bad records —
        only on a fundamentally unusable source (missing file, bad JSON)."""

    @abstractmethod
    def normalize_record(self, record: Dict[str, Any]) -> KnowledgeDocument:
        """Normalize one raw record; raise ValueError for invalid records."""

    def load(self) -> Tuple[List[KnowledgeDocument], List[str]]:
        """Load + normalize all records.

        Returns (documents, errors): errors holds descriptions of records
        that were rejected so failures are reported, never swallowed.
        """
        documents: List[KnowledgeDocument] = []
        errors: List[str] = []
        for index, record in enumerate(self.load_raw()):
            try:
                documents.append(self.normalize_record(record))
            except ValueError as exc:
                errors.append(f"record[{index}]: {exc}")
            except Exception as exc:  # noqa: BLE001 - one bad record must not kill the batch
                errors.append(f"record[{index}]: unexpected error: {exc}")
        logger.info(
            "knowledge_source_loaded source=%s documents=%d rejected=%d",
            self.name,
            len(documents),
            len(errors),
        )
        return documents, errors
