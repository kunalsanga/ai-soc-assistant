"""Embedding retrieval-quality comparison: hashing vs semantic.

Runs a small, manually verified query set against BOTH embedding providers
and reports actual top-k results, hit/miss vs ground truth, and latencies.
No numbers in the output are fabricated — everything is measured live.

Ground truth (verified against attack.mitre.org, Nov 2025 corpus):
  T1110       Brute Force                (Credential Access)
  T1110.001   Password Guessing          (sub-technique of T1110)
  T1110.003   Password Spraying          (sub-technique of T1110)
  T1550.002   Pass the Hash              (Use Alternate Authentication Material)

Usage:
  EMBEDDING_PROVIDER=semantic python scripts/compare_embeddings.py

The hashing corpus is indexed into a temporary collection
(<collection>__hashing_cmp) and deleted afterwards; the live semantic
collection is left untouched.
"""
import sys
import time
from pathlib import Path

# Add backend to path so we can import app
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings
from app.rag.knowledge.chunking import Chunker
from app.rag.knowledge.embeddings import (
    EmbeddingProvider,
    HashingEmbeddingProvider,
    SemanticEmbeddingProvider,
)
from app.rag.knowledge.normalize import normalize_documents
from app.rag.knowledge.sources.mitre import MitreAttackSource
from app.rag.knowledge.vectorstore.qdrant import QdrantIndex
from app.rag.retriever import Retriever
from app.security.schemas import RetrievalQuery, RetrievalQuerySet

TOP_K = 5

# (query_id, query text, ground-truth technique ids relevant to the query)
QUERY_SET = [
    ("q1_tech_id", "T1110", {"T1110", "T1110.001", "T1110.002", "T1110.003", "T1110.004"}),
    ("q2_brute_force", "brute force password guessing attacks", {"T1110", "T1110.001", "T1110.002", "T1110.003", "T1110.004"}),
    ("q3_credential_access", "credential access attacks against authentication", {"T1110", "T1110.001", "T1110.003", "T1555", "T1552", "T1557"}),
    ("q4_failed_auth", "failed authentication attempts against SSH service", {"T1110", "T1110.001", "T1110.003"}),
    ("q5_ssh_nonexistent", "SSH login attempts using a non-existent user account", {"T1110", "T1110.001", "T1110.003", "T1078.003"}),
    ("q6_pass_the_hash", "adversary reuses stolen password hashes to authenticate", {"T1550.002", "T1550"}),
]


def build_retriever(provider: EmbeddingProvider, collection: str) -> Retriever:
    index = QdrantIndex(
        url=settings.QDRANT_URL or "http://localhost:6333",
        collection=collection,
        api_key=settings.QDRANT_API_KEY,
        embedding_provider=provider,
    )
    return Retriever(index=index, embedding_provider=provider)


def run_queries(retriever: Retriever, queries) -> dict:
    per_query = {}
    total_start = time.perf_counter()
    for qid, text, truth in queries:
        qs = RetrievalQuerySet(
            alert_id="cmp",
            mitre_queries=[RetrievalQuery(query_id=qid, category="mitre", text=text)],
        )
        t0 = time.perf_counter()
        evidence = retriever.retrieve_query_set(qs, top_k=TOP_K, score_threshold=0.0)
        latency_ms = (time.perf_counter() - t0) * 1000
        hits = [
            {
                "id": ev.source_identifier or "?",
                "title": ev.title,
                "score": round(ev.similarity_score, 4),
            }
            for ev in evidence.evidence
        ]
        hit_ids = {h["id"] for h in hits}
        relevant_found = sorted(hit_ids & truth)
        per_query[qid] = {
            "query": text,
            "truth": sorted(truth),
            "hits": hits,
            "latency_ms": latency_ms,
            "hit": bool(relevant_found),
            "relevant_found": relevant_found,
            "best_rank": (
                next((i + 1 for i, h in enumerate(hits) if h["id"] in truth), None)
            ),
        }
    per_query["_total_ms"] = (time.perf_counter() - total_start) * 1000
    return per_query


def print_results(label: str, per_query: dict) -> int:
    print(f"\n{'=' * 78}\n{label}\n{'=' * 78}")
    n_hit = 0
    for qid, text, truth in QUERY_SET:
        r = per_query[qid]
        n_hit += 1 if r["hit"] else 0
        marker = "HIT " if r["hit"] else "MISS"
        best = f"first relevant @ rank {r['best_rank']}" if r["best_rank"] else "no relevant result in top-k"
        print(f"\n[{marker}] {qid}: {text!r}  ({r['latency_ms']:.0f} ms, {best})")
        for h in r["hits"]:
            flag = " *RELEVANT*" if h["id"] in truth else ""
            print(f"    {h['score']:.4f}  {h['id']:<12} {h['title'][:55]}{flag}")
    total = len(QUERY_SET)
    print(f"\nRecall@{TOP_K}: {n_hit}/{total}")
    return n_hit


def main() -> int:
    knowledge_dir = Path(settings.KNOWLEDGE_DATA_DIR)
    mitre_path = knowledge_dir / "enterprise-attack.json"
    if not mitre_path.exists():
        print(f"FATAL: MITRE bundle missing at {mitre_path}")
        return 1

    # --- semantic corpus (live collection, must be pre-indexed) --------------
    semantic = SemanticEmbeddingProvider(model_id=settings.SEMANTIC_EMBEDDING_MODEL)
    print(f"Semantic provider: {semantic.model_name} (dim={semantic.dimension})")

    # --- hashing corpus (temporary comparison collection) ---------------------
    hashing = HashingEmbeddingProvider(dimension=settings.EMBEDDING_DIMENSION)
    cmp_collection = f"{settings.QDRANT_COLLECTION}__hashing_cmp"
    print(f"Hashing provider: {hashing.model_name} (dim={hashing.dimension})")
    print(f"Indexing hashing corpus into temporary collection '{cmp_collection}'...")
    t0 = time.perf_counter()
    cmp_index = QdrantIndex(
        url=settings.QDRANT_URL or "http://localhost:6333",
        collection=cmp_collection,
        api_key=settings.QDRANT_API_KEY,
        embedding_provider=hashing,
    )
    documents, errors = MitreAttackSource(mitre_path).load()
    normalized, norm_errors = normalize_documents(documents)
    errors.extend(norm_errors)
    chunks = Chunker().chunk_documents(normalized)
    cmp_index.upsert_chunks(chunks)
    hashing_index_ms = (time.perf_counter() - t0) * 1000
    print(f"Hashing re-index: {len(chunks)} chunks in {hashing_index_ms:.0f} ms ({len(errors)} rejected)")

    try:
        # --- run both query sets ----------------------------------------------
        semantic_results = run_queries(build_retriever(semantic, settings.QDRANT_COLLECTION), QUERY_SET)
        hashing_results = run_queries(build_retriever(hashing, cmp_collection), QUERY_SET)

        s_hits = print_results(f"SEMANTIC — {semantic.model_name} (dim={semantic.dimension})", semantic_results)
        h_hits = print_results(f"HASHING — {hashing.model_name} (dim={hashing.dimension})", hashing_results)

        print(f"\n{'=' * 78}\nSUMMARY (measured, top_k={TOP_K})\n{'=' * 78}")
        print(f"Recall@{TOP_K} over {len(QUERY_SET)} queries: semantic {s_hits}/{len(QUERY_SET)} | hashing {h_hits}/{len(QUERY_SET)}")
        print(f"Avg query latency: semantic {sum(semantic_results[q[0]]['latency_ms'] for q in QUERY_SET)/len(QUERY_SET):.0f} ms | hashing {sum(hashing_results[q[0]]['latency_ms'] for q in QUERY_SET)/len(QUERY_SET):.0f} ms")
        return 0 if s_hits == len(QUERY_SET) else 1
    finally:
        client = cmp_index._get_client()
        client.delete_collection(cmp_collection)
        print(f"\nTemporary collection '{cmp_collection}' deleted.")


if __name__ == "__main__":
    sys.exit(main())
