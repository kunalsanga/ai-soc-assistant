"""Phase 4B: Retriever implementation.

Consumes a RetrievalQuerySet, executes similarity search against Qdrant,
and produces a ranked EvidenceSet with full provenance.
"""
import logging
import uuid
from typing import Any, Dict, List, Optional, Set

from app.core.config import settings
from app.rag.knowledge.embeddings.base import EmbeddingProvider
from app.rag.knowledge.vectorstore.qdrant import QdrantIndex
from app.rag.schemas import Evidence, EvidenceSet
from app.security.schemas import RetrievalQuerySet

logger = logging.getLogger(__name__)


class RetrieverError(Exception):
    """Base error for retrieval failures."""


class Retriever:
    """Retrieves and ranks evidence from the knowledge base."""

    def __init__(
        self,
        index: QdrantIndex,
        embedding_provider: EmbeddingProvider,
    ):
        self._index = index
        self._provider = embedding_provider

    def retrieve_query_set(
        self,
        query_set: RetrievalQuerySet,
        top_k: Optional[int] = None,
        score_threshold: Optional[float] = None,
    ) -> EvidenceSet:
        """Execute multiple queries and return a single ranked EvidenceSet.
        
        Qdrant Distance.COSINE semantic note:
        Qdrant returns a similarity score where higher is better (exact match = 1.0).
        Thus, score_threshold behaves as a minimum cutoff, and results are 
        sorted descending by score.

        Deduplication logic:
        If multiple queries retrieve the same chunk, they are merged. 
        The highest similarity_score is retained, and all query_ids and 
        categories are preserved to maintain complete retrieval provenance.
        """
        top_k = top_k if top_k is not None else settings.RETRIEVAL_TOP_K
        score_threshold = score_threshold if score_threshold is not None else settings.RETRIEVAL_SCORE_THRESHOLD

        # chunk_id -> dict of accumulated state
        accumulated_chunks: Dict[str, Dict[str, Any]] = {}

        for query in query_set.all_queries():
            # Skip empty queries
            if not query.text.strip():
                logger.warning(f"retriever_skip_empty_query query_id={query.query_id}")
                continue
                
            try:
                # Embed query text
                vector = self._provider.embed_text(query.text)
                
                # Search vector store
                results = self._index.search(
                    query_vector=vector,
                    top_k=top_k,
                    score_threshold=score_threshold,
                )
                
                for hit in results:
                    score = float(hit["score"])
                    payload = hit["payload"]
                    chunk_id = payload.get("chunk_id")
                    
                    if not chunk_id:
                        continue
                        
                    if chunk_id in accumulated_chunks:
                        state = accumulated_chunks[chunk_id]
                        if query.query_id not in state["query_ids"]:
                            state["query_ids"].append(query.query_id)
                        if query.category not in state["categories"]:
                            state["categories"].append(query.category)
                        # Retain the strongest match score for the chunk
                        if score > state["similarity_score"]:
                            state["similarity_score"] = score
                    else:
                        accumulated_chunks[chunk_id] = {
                            "query_ids": [query.query_id],
                            "categories": [query.category],
                            "source": payload.get("source", ""),
                            "document_id": payload.get("document_id", ""),
                            "chunk_id": chunk_id,
                            "source_identifier": payload.get("source_identifier"),
                            "source_url": payload.get("source_url"),
                            "title": payload.get("title", ""),
                            "content": payload.get("content", ""),
                            "similarity_score": score,
                            "chunk_index": int(payload.get("chunk_index", 0)),
                            "metadata": payload.get("metadata", {}),
                        }
                    
            except Exception as e:
                logger.error(f"retriever_query_failed query_id={query.query_id} error={e}")
                # We continue to the next query rather than crashing everything
                
        all_evidence: List[Evidence] = []
        for chunk_id, state in accumulated_chunks.items():
            evidence = Evidence(
                evidence_id=str(uuid.uuid4()),
                query_ids=state["query_ids"],
                categories=state["categories"],
                source=state["source"],
                document_id=state["document_id"],
                chunk_id=state["chunk_id"],
                source_identifier=state["source_identifier"],
                source_url=state["source_url"],
                title=state["title"],
                content=state["content"],
                similarity_score=state["similarity_score"],
                chunk_index=state["chunk_index"],
                metadata=state["metadata"],
            )
            all_evidence.append(evidence)

        # Deterministic sort: primarily by score (desc), tie-break by chunk_id (asc)
        all_evidence.sort(key=lambda x: (-x.similarity_score, x.chunk_id))
        
        # Apply final limit
        final_evidence = all_evidence[:top_k]

        logger.info(
            f"retriever_complete alert_id={query_set.alert_id} "
            f"queries={len(query_set.all_queries())} retrieved={len(final_evidence)}"
        )

        return EvidenceSet(
            alert_id=query_set.alert_id,
            evidence=final_evidence,
            metadata={
                "total_queries_executed": len(query_set.all_queries()),
                "total_unique_chunks_found": len(accumulated_chunks),
                "top_k_requested": top_k,
                "score_threshold": score_threshold,
            }
        )
