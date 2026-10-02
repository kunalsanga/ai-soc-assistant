"""Deterministic knowledge-document normalization (spec Step 6).

Cleans textual content (whitespace collapsing) while preserving
security-relevant text, sanitizes metadata, rejects clearly invalid records,
and never fabricates fields. Input records/documents are never mutated.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List

from app.rag.knowledge.schemas import KnowledgeDocument

logger = logging.getLogger(__name__)

_WS_RE = re.compile(r"[ \t]+")
_MULTI_NEWLINE_RE = re.compile(r"\n{3,}")

_MAX_TITLE_LEN = 300
_MAX_METADATA_STR_LEN = 500
_MAX_CONTENT_LEN = 100_000


def _clean_text(text: str) -> str:
    """Collapse runs of spaces/tabs; trim; keep newlines intact."""
    cleaned = _WS_RE.sub(" ", text)
    cleaned = "\n".join(line.strip() for line in cleaned.split("\n"))
    cleaned = _MULTI_NEWLINE_RE.sub("\n\n", cleaned)
    return cleaned.strip()


def _clean_metadata_value(value: Any) -> Any:
    """Recursively sanitize a metadata value; drop empty containers and
    over-long strings rather than fabricating replacements."""
    if value is None:
        return None
    if isinstance(value, str):
        cleaned = _clean_text(value)
        if not cleaned:
            return None
        return cleaned[:_MAX_METADATA_STR_LEN]
    if isinstance(value, bool) or isinstance(value, int) or isinstance(value, float):
        return value
    if isinstance(value, list):
        cleaned_items = [_clean_metadata_value(v) for v in value]
        return [v for v in cleaned_items if v is not None] or None
    if isinstance(value, dict):
        cleaned_dict = {
            str(k): _clean_metadata_value(v)
            for k, v in value.items()
        }
        return {k: v for k, v in cleaned_dict.items() if v is not None} or None
    return str(value)


def _sanitize_metadata(metadata: Dict[str, Any]) -> Dict[str, Any]:
    cleaned = {str(k): _clean_metadata_value(v) for k, v in metadata.items()}
    return {k: v for k, v in cleaned.items() if v is not None}


def normalize_document(document: KnowledgeDocument) -> KnowledgeDocument:
    """Normalize one document. Deterministic; input is never mutated.

    Raises ValueError for clearly invalid documents (no id, no title, empty
    content and no detection text at all).
    """
    document_id = (document.document_id or "").strip()
    if not document_id:
        raise ValueError("document_id is required")
    title = (document.title or "").strip()
    if not title:
        raise ValueError(f"document '{document_id}' has an empty title")

    content = _clean_text(document.content or "")
    if not content:
        raise ValueError(f"document '{document_id}' has no content")

    if len(content) > _MAX_CONTENT_LEN:
        logger.warning(
            "document_content_truncated document_id=%s length=%d",
            document_id,
            len(content),
        )
        content = content[:_MAX_CONTENT_LEN]

    return KnowledgeDocument(
        document_id=document_id,
        source=(document.source or "").strip() or document.source,
        document_type=(document.document_type or "").strip() or document.document_type,
        title=title[:_MAX_TITLE_LEN],
        content=content,
        source_url=document.source_url,
        source_identifier=document.source_identifier,
        metadata=_sanitize_metadata(document.metadata),
        version=document.version,
        created=document.created,
        updated=document.updated,
    )


def normalize_documents(
    documents: List[KnowledgeDocument],
) -> tuple[List[KnowledgeDocument], List[str]]:
    """Normalize a batch; returns (documents, rejection reasons)."""
    normalized: List[KnowledgeDocument] = []
    errors: List[str] = []
    for document in documents:
        try:
            normalized.append(normalize_document(document))
        except ValueError as exc:
            errors.append(str(exc))
    logger.info(
        "documents_normalized total=%d kept=%d rejected=%d",
        len(documents),
        len(normalized),
        len(errors),
    )
    return normalized, errors
