"""Knowledge search route — read-only lookup over the indexed Qdrant corpus.

Endpoints:
  GET /knowledge/search?q=...&source=...   Semantic search over the real
                                           indexed records (MITRE ATT&CK /
                                           NVD CVE).
  GET /knowledge/stats                     Real per-source point counts.

Scores are genuine cosine similarities from Qdrant; provenance (source,
document_id, source_identifier, source_url) comes from the stored payload.
No record is ever invented: if Qdrant is unreachable, the endpoint fails
loudly with 503.
"""
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.core.config import settings
from app.rag.knowledge.embeddings import build_embedding_provider
from app.rag.knowledge.vectorstore.qdrant import QdrantIndex, VectorStoreError

logger = logging.getLogger(__name__)

router = APIRouter()

_KNOWN_SOURCES = {"mitre_attack", "nvd_cve"}


def _build_index() -> QdrantIndex:
    provider = build_embedding_provider()
    return QdrantIndex(
        url=settings.QDRANT_URL or "http://localhost:6333",
        collection=settings.QDRANT_COLLECTION,
        api_key=settings.QDRANT_API_KEY,
        embedding_provider=provider,
    )


@router.get("/search")
async def search_knowledge(
    q: str = Query(..., min_length=2, description="Search text"),
    source: str = Query("all", description="Filter: all | mitre_attack | nvd_cve"),
    limit: int = Query(10, ge=1, le=50),
) -> List[Dict[str, Any]]:
    if source != "all" and source not in _KNOWN_SOURCES:
        raise HTTPException(status_code=400, detail=f"Unknown source '{source}'")

    index = _build_index()
    # Build the embedding provider used for the query (same one the index got).
    provider = index._provider
    try:
        query_vector = provider.embed_text(q)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"Embedding provider failed: {exc}") from exc

    payload_filter: Optional[Dict[str, Any]] = None
    if source != "all":
        payload_filter = {"must": [{"key": "source", "match": {"value": source}}]}

    import re

    # Check for bare identifiers (e.g., T1110, CVE-2021-44228) which benefit from exact payload filtering
    ident_match = re.search(r"\b(T\d{4}(?:\.\d{3})?|CVE-\d{4}-\d{4,7})\b", q, re.IGNORECASE)
    exact_hits: List[Dict[str, Any]] = []
    if ident_match:
        ident_val = ident_match.group(1).upper()
        exact_filter: Dict[str, Any] = {
            "must": [{"key": "source_identifier", "match": {"value": ident_val}}]
        }
        if source != "all":
            exact_filter["must"].append({"key": "source", "match": {"value": source}})
        try:
            exact_hits = index.search(query_vector, top_k=limit, payload_filter=exact_filter)
        except Exception as exc:  # noqa: BLE001
            logger.debug("Exact identifier lookup note: %s", exc)

    try:
        hits = index.search(query_vector, top_k=limit, payload_filter=payload_filter)
    except VectorStoreError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    finally:
        index.close()

    # Merge exact identifier hits ahead of general semantic hits (dedupe by chunk_id)
    seen_chunk_ids = set()
    merged_hits: List[Dict[str, Any]] = []
    for hit in exact_hits + hits:
        chunk_id = (hit.get("payload") or {}).get("chunk_id")
        if chunk_id and chunk_id in seen_chunk_ids:
            continue
        if chunk_id:
            seen_chunk_ids.add(chunk_id)
        merged_hits.append(hit)
        if len(merged_hits) >= limit:
            break

    results: List[Dict[str, Any]] = []
    for hit in merged_hits:
        payload = hit.get("payload", {})
        results.append(
            {
                "score": round(hit.get("score", 0.0), 4),
                "source": payload.get("source"),
                "document_id": payload.get("document_id"),
                "source_identifier": payload.get("source_identifier"),
                "source_url": payload.get("source_url"),
                "title": payload.get("title"),
                "chunk_index": payload.get("chunk_index"),
                "content": payload.get("content"),
                "cve_id": (payload.get("metadata") or {}).get("cve_id"),
                "techniques": (payload.get("metadata") or {}).get("mitre_techniques"),
            }
        )
    return results


@router.get("/stats")
async def knowledge_stats() -> Dict[str, Any]:
    """Real per-source point counts from the Qdrant collection."""
    index = _build_index()
    client = index._get_client()
    try:
        counts: Dict[str, Any] = {}
        total = client.count(collection_name=index._collection, exact=True)
        counts["all"] = total.count
        for source_name in sorted(_KNOWN_SOURCES):
            result = client.count(
                collection_name=index._collection,
                count_filter={"must": [{"key": "source", "match": {"value": source_name}}]},
                exact=True,
            )
            counts[source_name] = result.count
        return {
            "collection": index._collection,
            "embedding": provider_name(index),
            "counts": counts,
        }
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"Qdrant is unreachable: {exc}") from exc
    finally:
        index.close()


def provider_name(index: QdrantIndex) -> str:
    try:
        return index._provider.model_name
    except Exception:  # noqa: BLE001
        return settings.EMBEDDING_PROVIDER
