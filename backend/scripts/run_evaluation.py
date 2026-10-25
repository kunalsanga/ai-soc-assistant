"""Research evaluation runner (Milestone 3 / Milestone 7).

Runs the PRODUCTION orchestrator (no competing pipeline) over a
version-controlled dataset in three modes:

    A. llm_only        Alert -> Qwen3 -> Analysis
    B. standard_rag    Alert -> naive retrieval -> evidence -> Qwen3
    C. evidence_aware  Alert -> security context -> structured retrieval
                       -> evidence validation -> Qwen3

Every metric is computed from recorded artifacts. Nothing is estimated.
The run is checkpointed after every single execution, so an interrupted
session still leaves usable partial results.

Outputs (per run): backend/evaluation/results/<run_id>/
    results.json       machine-readable full results
    results.csv        one row per (case, mode)
    report.md          human-readable report
    ablation.json      retrieval-only ablation (no LLM cost)

Usage:
    python scripts/run_evaluation.py [--limit N] [--modes m1,m2] [--no-ablation]
"""
import argparse
import asyncio
import csv
import json
import re
import statistics
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Add backend to path so we can import app
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings
from app.db.database import AsyncSessionLocal
from app.db.models.alert import Alert
from app.evaluation.metrics import (
    benign_evaluation,
    cve_prf1,
    extract_cves,
    extract_techniques,
    mean,
    median,
    mrr,
    rank_of_first_relevant,
    recall_at_k,
    severity_band_match,
    stdev,
    technique_prf1,
    valid_evidence_reference_rate,
    validate_dataset_schema,
)
from app.llm.providers.ollama import OllamaLLMProvider
# Import wazuh.service BEFORE security.normalization: the wazuh package pulls
# both in its safe order; the reverse order creates a circular import.
from app.wazuh.service import AlertService  # isort: skip
from app.rag.knowledge.embeddings import (
    HashingEmbeddingProvider,
    SemanticEmbeddingProvider,
)
from app.rag.knowledge.vectorstore.qdrant import QdrantIndex
from app.rag.retriever import Retriever
from app.security.normalization import normalize_wazuh_alert
from app.security.schemas import RetrievalQuery, RetrievalQuerySet
from app.services.analysis import AnalysisService
from app.services.orchestrator import SOCAnalysisOrchestrator, AnalysisMode

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DATASET_PATH = BACKEND_DIR / "evaluation" / "dataset_v2.json"
RESULTS_ROOT = BACKEND_DIR / "evaluation" / "results"

MODES = ["llm_only", "standard_rag", "evidence_aware"]


# ---------------------------------------------------------------------------
# Wiring (identical to the API's get_orchestrator — one pipeline only)
# ---------------------------------------------------------------------------

def build_orchestrator() -> SOCAnalysisOrchestrator:
    llm_provider = OllamaLLMProvider(
        base_url=settings.LLM_BASE_URL, model=settings.LLM_MODEL
    )
    embedding_provider = SemanticEmbeddingProvider(
        model_id=settings.SEMANTIC_EMBEDDING_MODEL
    )
    index = QdrantIndex(
        url=settings.QDRANT_URL or "http://localhost:6333",
        collection=settings.QDRANT_COLLECTION,
        api_key=settings.QDRANT_API_KEY,
        embedding_provider=embedding_provider,
    )
    retriever = Retriever(index=index, embedding_provider=embedding_provider)
    return SOCAnalysisOrchestrator(
        alert_service=AlertService(),
        analysis_service=AnalysisService(),
        llm_provider=llm_provider,
        retriever=retriever,
    )


async def seed_alert(case: dict) -> int:
    """Persist the case alert idempotently; return its DB id."""
    from sqlalchemy import select

    external_id = case["alert"]["id"]
    async with AsyncSessionLocal() as db:
        existing = (
            await db.execute(
                select(Alert).where(Alert.external_alert_id == external_id)
            )
        ).scalar_one_or_none()
        if existing is not None:
            return existing.id

        normalized = normalize_wazuh_alert(case["alert"])
        row = Alert(
            external_alert_id=normalized.external_alert_id,
            timestamp=normalized.timestamp,
            severity=normalized.severity,
            rule_id=normalized.rule_id,
            rule_description=normalized.rule_description,
            agent_name=normalized.agent_name,
            source_ip=normalized.source_ip,
            destination_ip=normalized.destination_ip,
            username=normalized.username,
            raw_data=json.dumps(case["alert"], default=str),
            status="open",
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)
        return row.id


# ---------------------------------------------------------------------------
# One evaluation run (case x mode)
# ---------------------------------------------------------------------------

async def run_one(case: dict, db_alert_id: int, mode: str, orchestrator) -> dict:
    started = time.perf_counter()
    record = {
        "case_id": case["case_id"],
        "category": case["category"],
        "mode": mode,
        "db_alert_id": db_alert_id,
        "error": None,
    }
    try:
        analysis, artifacts = await orchestrator.analyze_alert_with_artifacts(
            AsyncSessionLocal(), db_alert_id, AnalysisMode(mode)
        )
    except Exception as exc:  # noqa: BLE001 — failures are data, not crashes
        record["error"] = f"{type(exc).__name__}: {exc}"
        record["wall_latency_seconds"] = time.perf_counter() - started
        return record

    wall = time.perf_counter() - started
    parsed = artifacts.parsed_analysis
    evidence_set = artifacts.evidence_set
    gt = case["ground_truth"]

    # --- retrieval metrics (RAG modes only) ---------------------------------
    ranks: list = []
    if evidence_set is not None:
        ranked_ids = [
            ev.source_identifier for ev in evidence_set.evidence
            if ev.source_identifier
        ]
        ranks = [rank_of_first_relevant(ranked_ids, set(gt["relevant_knowledge_ids"]))]

    # --- MITRE technique metrics (from pre-validation structured output) ----
    predicted = parsed.suspected_techniques if parsed else []
    prf1 = technique_prf1(predicted, set(gt.get("expected_techniques", [])))

    # --- CVE reference metrics ----------------------------------------------
    analysis_text = " ".join(filter(None, [
        parsed.summary if parsed else "",
        parsed.reasoning if parsed else "",
        " ".join(parsed.suspected_techniques if parsed else []),
        " ".join(parsed.observed_indicators if parsed else []),
        parsed.limitations if parsed else "",
    ]))
    predicted_cves = extract_cves(analysis_text)
    expected_cves = set(gt.get("expected_cves", []))
    c_prf1 = cve_prf1(predicted_cves, expected_cves)

    # --- Benign / Negative Control evaluation -------------------------------
    is_benign = gt.get("is_benign", False)
    b_eval = benign_evaluation(
        parsed.severity_assessment if parsed else None,
        is_benign,
        gt.get("expected_severity_band", "low"),
    )

    # --- grounding ----------------------------------------------------------
    ref_ids = [r.evidence_id for r in (parsed.evidence_references if parsed else [])]
    valid_ids = {ev.evidence_id for ev in evidence_set.evidence} if evidence_set else set()
    grounding = valid_evidence_reference_rate(ref_ids, valid_ids)

    record.update({
        "wall_latency_seconds": wall,
        "llm_latency_seconds": artifacts.llm_latency_seconds,
        "llm_model": artifacts.llm_model,
        "llm_tokens": artifacts.llm_tokens,
        "analysis_id": analysis.id,
        "summary": parsed.summary if parsed else None,
        "confidence": parsed.confidence if parsed else None,
        "predicted_techniques": predicted,
        "technique_prf1": prf1,
        "expected_cves": list(expected_cves),
        "predicted_cves": predicted_cves,
        "cve_prf1": c_prf1,
        "is_benign": is_benign,
        "benign_eval": b_eval,
        "severity_band_match": severity_band_match(
            parsed.severity_assessment if parsed else None,
            gt["expected_severity_band"],
        ),
        "expected_severity_band": gt["expected_severity_band"],
        "observed_indicators": parsed.observed_indicators if parsed else [],
        "investigation_step_count": (
            len([s for s in (parsed.investigation_steps or []) if s.strip()])
            if parsed else 0
        ),
        "evidence_reference_count": len(ref_ids),
        "valid_evidence_reference_rate": grounding,
        "retrieved": [
            {
                "id": ev.source_identifier,
                "title": ev.title,
                "score": round(ev.similarity_score, 4),
            }
            for ev in (evidence_set.evidence if evidence_set else [])
        ],
        "retrieval_first_relevant_rank": ranks[0] if ranks else None,
        "limitations": parsed.limitations if parsed else None,
    })
    return record


# ---------------------------------------------------------------------------
# Retrieval-only ablation (no LLM cost)
# ---------------------------------------------------------------------------

async def run_ablation(dataset: dict, alert_ids: dict) -> dict:
    semantic = SemanticEmbeddingProvider(model_id=settings.SEMANTIC_EMBEDDING_MODEL)
    hashing = HashingEmbeddingProvider(dimension=settings.EMBEDDING_DIMENSION)

    configs = {
        # production path: semantic + MITRE ID anchoring
        "semantic_anchored": Retriever(
            index=QdrantIndex(
                url=settings.QDRANT_URL or "http://localhost:6333",
                collection=settings.QDRANT_COLLECTION,
                api_key=settings.QDRANT_API_KEY,
                embedding_provider=semantic,
            ),
            embedding_provider=semantic,
        ),
        # semantic without ID anchoring: category override disables the filter
        "semantic_no_anchoring": Retriever(
            index=QdrantIndex(
                url=settings.QDRANT_URL or "http://localhost:6333",
                collection=settings.QDRANT_COLLECTION,
                api_key=settings.QDRANT_API_KEY,
                embedding_provider=semantic,
            ),
            embedding_provider=semantic,
        ),
    }

    results = {}
    for config_name, retriever in configs.items():
        ranks, latencies = [], []
        per_case = {}
        for case in dataset["cases"]:
            _, qs = AlertService().get_security_context(
                normalize_wazuh_alert(case["alert"])
            )
            if config_name == "semantic_no_anchoring":
                # Same query texts, category 'security' -> no identifier filter.
                for q in qs.all_queries():
                    q.category = "security"
            t0 = time.perf_counter()
            evidence = retriever.retrieve_query_set(qs, top_k=5)
            latencies.append((time.perf_counter() - t0) * 1000)
            ranked_ids = [ev.source_identifier for ev in evidence.evidence if ev.source_identifier]
            rank = rank_of_first_relevant(ranked_ids, set(case["ground_truth"]["relevant_knowledge_ids"]))
            ranks.append(rank)
            per_case[case["case_id"]] = {"rank": rank, "top5": ranked_ids[:5]}
        results[config_name] = {
            "recall@5": recall_at_k(ranks, 5),
            "recall@1": recall_at_k(ranks, 1),
            "mrr": mrr(ranks),
            "avg_latency_ms": mean(latencies),
            "per_case": per_case,
        }

    # Hashing ablation needs a 256-dim collection — reuse the comparison
    # collection created on demand, then delete it.
    cmp_collection = f"{settings.QDRANT_COLLECTION}__eval_hashing"
    hashing_index = QdrantIndex(
        url=settings.QDRANT_URL or "http://localhost:6333",
        collection=cmp_collection,
        api_key=settings.QDRANT_API_KEY,
        embedding_provider=hashing,
    )
    from app.rag.knowledge.chunking import Chunker
    from app.rag.knowledge.sources.mitre import MitreAttackSource
    mitre_path = BACKEND_DIR / "knowledge" / "enterprise-attack.json"
    documents, _ = MitreAttackSource(mitre_path).load()
    from app.rag.knowledge.normalize import normalize_documents
    normalized, _ = normalize_documents(documents)
    hashing_index.upsert_chunks(Chunker().chunk_documents(normalized))
    try:
        hashing_retriever = Retriever(index=hashing_index, embedding_provider=hashing)
        ranks, latencies, per_case = [], [], {}
        for case in dataset["cases"]:
            _, qs = AlertService().get_security_context(
                normalize_wazuh_alert(case["alert"])
            )
            t0 = time.perf_counter()
            evidence = hashing_retriever.retrieve_query_set(qs, top_k=5)
            latencies.append((time.perf_counter() - t0) * 1000)
            ranked_ids = [ev.source_identifier for ev in evidence.evidence if ev.source_identifier]
            rank = rank_of_first_relevant(ranked_ids, set(case["ground_truth"]["relevant_knowledge_ids"]))
            ranks.append(rank)
            per_case[case["case_id"]] = {"rank": rank, "top5": ranked_ids[:5]}
        results["hashing"] = {
            "recall@5": recall_at_k(ranks, 5),
            "recall@1": recall_at_k(ranks, 1),
            "mrr": mrr(ranks),
            "avg_latency_ms": mean(latencies),
            "per_case": per_case,
        }
    finally:
        hashing_index._get_client().delete_collection(cmp_collection)

    return results


# ---------------------------------------------------------------------------
# Aggregation + output
# ---------------------------------------------------------------------------

def aggregate(records: list) -> dict:
    agg: dict = {}
    for mode in MODES:
        runs = [r for r in records if r["mode"] == mode]
        if not runs:
            continue
        lat = [r["wall_latency_seconds"] for r in runs if r.get("wall_latency_seconds")]
        llm_lat = [r["llm_latency_seconds"] for r in runs if r.get("llm_latency_seconds")]
        sev = [r["severity_band_match"] for r in runs if r.get("severity_band_match") is not None]
        prf = [r["technique_prf1"] for r in runs if r.get("technique_prf1")]
        cve_prfs = [r["cve_prf1"] for r in runs if r.get("cve_prf1")]
        ground = [r["valid_evidence_reference_rate"] for r in runs if r.get("valid_evidence_reference_rate") is not None]
        ranks = [r["retrieval_first_relevant_rank"] for r in runs if "retrieval_first_relevant_rank" in r]
        
        # Benign vs attack breakdown
        benign_runs = [r for r in runs if r.get("is_benign")]
        false_alarms = sum(1 for r in benign_runs if (r.get("benign_eval") or {}).get("is_false_alarm"))
        correctly_benign = sum(1 for r in benign_runs if (r.get("benign_eval") or {}).get("correctly_benign"))

        n = len(runs)
        agg[mode] = {
            "cases": n,
            "errors": sum(1 for r in runs if r.get("error")),
            "wall_latency_seconds": {
                "mean": mean(lat), "median": median(lat), "stdev": stdev(lat),
            },
            "llm_latency_seconds": {
                "mean": mean(llm_lat), "median": median(llm_lat), "stdev": stdev(llm_lat),
            },
            # severity: parsed-band agreement among parseable analyses
            "severity_band_accuracy": mean([1.0 if s else 0.0 for s in sev]) if sev else None,
            "severity_parseable_count": len(sev),
            "technique_precision": mean([p["precision"] for p in prf if p["precision"] is not None]),
            "technique_recall": mean([p["recall"] for p in prf if p["recall"] is not None]),
            "technique_f1": mean([p["f1"] for p in prf if p["f1"] is not None]),
            "cve_precision": mean([p["precision"] for p in cve_prfs if p.get("precision") is not None]),
            "cve_recall": mean([p["recall"] for p in cve_prfs if p.get("recall") is not None]),
            "cve_f1": mean([p["f1"] for p in cve_prfs if p.get("f1") is not None]),
            "benign_cases_count": len(benign_runs),
            "false_alarms_on_benign": false_alarms,
            "false_alarm_rate_on_benign": (false_alarms / len(benign_runs)) if benign_runs else None,
            "benign_accuracy": (correctly_benign / len(benign_runs)) if benign_runs else None,
            "valid_evidence_reference_rate": mean(ground) if ground else None,
            "grounding_coverage": len(ground),
            # RAG modes: recall over all cases in the mode (misses included)
            "retrieval_recall@5": recall_at_k(ranks, 5) if ranks else None,
            "retrieval_recall@1": recall_at_k(ranks, 1) if ranks else None,
            "retrieval_mrr": mrr(ranks) if ranks else None,
        }
    return agg


def write_csv(records: list, path: Path) -> None:
    fields = [
        "case_id", "category", "mode", "db_alert_id", "analysis_id", "error",
        "wall_latency_seconds", "llm_latency_seconds", "confidence",
        "is_benign", "severity_band_match", "expected_severity_band",
        "technique_precision", "technique_recall", "technique_f1",
        "expected_cves", "predicted_cves", "cve_precision", "cve_recall", "cve_f1",
        "is_false_alarm",
        "valid_evidence_reference_rate", "evidence_reference_count",
        "retrieval_first_relevant_rank", "predicted_techniques",
    ]
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for r in records:
            row = dict(r)
            prf = row.get("technique_prf1") or {}
            c_prf = row.get("cve_prf1") or {}
            b_ev = row.get("benign_eval") or {}
            row["technique_precision"] = prf.get("precision")
            row["technique_recall"] = prf.get("recall")
            row["technique_f1"] = prf.get("f1")
            row["cve_precision"] = c_prf.get("precision")
            row["cve_recall"] = c_prf.get("recall")
            row["cve_f1"] = c_prf.get("f1")
            row["is_false_alarm"] = b_ev.get("is_false_alarm")
            row["expected_cves"] = ";".join(row.get("expected_cves") or [])
            row["predicted_cves"] = ";".join(row.get("predicted_cves") or [])
            row["predicted_techniques"] = ";".join(row.get("predicted_techniques") or [])
            writer.writerow({k: row.get(k) for k in fields})


def write_report(agg: dict, ablation: dict | None, meta: dict, records: list, path: Path) -> None:
    lines = [
        "# Evaluation Report",
        "",
        f"- Run ID: {meta['run_id']}",
        f"- Timestamp (UTC): {meta['timestamp_utc']}",
        f"- Dataset: {meta['dataset_version']} ({meta['num_cases']} cases) [Synthetic: {meta.get('synthetic', True)}]",
        f"- Dataset file: {meta.get('dataset_path', 'unknown')}",
        f"- LLM: {meta['llm_model']} @ {meta['llm_base_url']} (temperature 0.0)",
        f"- Embedding: {meta['embedding_model']}",
        f"- Qdrant collection: {meta['qdrant_collection']}",
        "",
        "## Aggregate results per mode (measured)",
        "",
        "| Metric | " + " | ".join(m for m in MODES if m in agg) + " |",
        "|---|" + "---|" * len([m for m in MODES if m in agg]),
    ]

    lines += [
        "",
    ]
    for label, key in [
        ("Wall latency mean (s)", ("wall_latency_seconds", "mean")),
        ("Wall latency median (s)", ("wall_latency_seconds", "median")),
        ("Wall latency stdev (s)", ("wall_latency_seconds", "stdev")),
        ("LLM latency mean (s)", ("llm_latency_seconds", "mean")),
        ("Severity band accuracy*", "severity_band_accuracy"),
        ("Severity parseable cases", "severity_parseable_count"),
        ("Technique precision", "technique_precision"),
        ("Technique recall", "technique_recall"),
        ("Technique F1", "technique_f1"),
        ("CVE precision", "cve_precision"),
        ("CVE recall", "cve_recall"),
        ("CVE F1", "cve_f1"),
        ("Benign cases evaluated", "benign_cases_count"),
        ("Benign false alarms (high/crit)", "false_alarms_on_benign"),
        ("Benign false alarm rate", "false_alarm_rate_on_benign"),
        ("Benign correct classification", "benign_accuracy"),
        ("Valid evidence reference rate", "valid_evidence_reference_rate"),
        ("Grounding coverage (cases)", "grounding_coverage"),
        ("Retrieval Recall@5", "retrieval_recall@5"),
        ("Retrieval Recall@1", "retrieval_recall@1"),
        ("Retrieval MRR", "retrieval_mrr"),
        ("Errors", "errors"),
    ]:
        cells = []
        for m in MODES:
            v = agg.get(m, {}).get(key)
            if isinstance(v, dict):
                v = v.get("mean")
            cells.append("N/A" if v is None else f"{v:.3f}")
        lines.append(f"| {label} | " + " | ".join(cells) + " |")

    lines += [
        "",
        "*Severity band accuracy counts only analyses whose severity text yielded a band word; "
        "coverage is reported next to it. No imputation is applied.",
        "",
    ]

    if ablation:
        lines += ["## Retrieval ablation (retrieval-only, no LLM)", "",
                  "| Config | Recall@5 | Recall@1 | MRR | Avg latency (ms) |", "|---|---|---|---|---|"]
        for name, a in ablation.items():
            lines.append(
                f"| {name} | {a['recall@5']:.3f} | {a['recall@1']:.3f} | "
                f"{a['mrr']:.3f} | {a['avg_latency_ms']:.0f} |"
            )
        lines.append("")

    lines += ["## Per-case results", ""]
    for r in records:
        err = f" ERROR: {r['error']}" if r.get("error") else ""
        cve_str = f" CVE_F1={(r.get('cve_prf1') or {}).get('f1')}" if r.get("expected_cves") else ""
        benign_str = " [BENIGN]" if r.get("is_benign") else ""
        lines.append(
            f"- {r['case_id']}{benign_str} [{r['mode']}]: rank={r.get('retrieval_first_relevant_rank')} "
            f"P={(r.get('technique_prf1') or {}).get('precision')} "
            f"R={(r.get('technique_prf1') or {}).get('recall')} "
            f"grounding={r.get('valid_evidence_reference_rate')}{cve_str} "
            f"latency={r.get('wall_latency_seconds', 0):.1f}s{err}"
        )

    lines += [
        "",
        "## Limitations",
        "",
        "- Hand-authored synthetic dataset with negative controls; all records are explicitly simulated.",
        "- Severity grading uses band-word extraction from free text and may miss paraphrases (coverage reported).",
        "- Technique matching is exact-id; base/sub-technique equivalences are not credited.",
    ]
    path.write_text("\n".join(lines), encoding="utf-8")


_SAFE_RUN_ID_RE = re.compile(r"^[a-zA-Z0-9_\-]+$")


def validate_and_load_resume(
    run_id: str,
    results_root: Path,
    valid_case_ids: set,
    valid_modes: list,
) -> tuple[Path, list[dict]]:
    """Validate resume request and load existing partial records.

    Raises ValueError with a clear, descriptive message upon any validation error.
    Returns (run_dir, records).
    """
    if not _SAFE_RUN_ID_RE.match(run_id):
        raise ValueError(
            f"Invalid run ID format: '{run_id}'. Run IDs must only contain alphanumeric characters, underscores, and hyphens."
        )

    run_dir = results_root / run_id
    if not run_dir.exists() or not run_dir.is_dir():
        raise ValueError(f"Resume run directory does not exist: {run_dir}")

    partial_path = run_dir / "results_partial.json"
    if not partial_path.exists():
        raise ValueError(
            f"Cannot resume run '{run_id}': partial checkpoint file not found at {partial_path}"
        )

    try:
        data = json.loads(partial_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ValueError(f"Corrupt or unreadable JSON in {partial_path}: {exc}") from exc

    if not isinstance(data, dict):
        raise ValueError(f"Invalid format in {partial_path}: top-level element must be a JSON object.")

    loaded_run_id = data.get("run_id")
    if loaded_run_id and loaded_run_id != run_id:
        raise ValueError(
            f"Run ID mismatch: expected '{run_id}' but checkpoint contains '{loaded_run_id}'."
        )

    records = data.get("records")
    if not isinstance(records, list):
        raise ValueError(f"Invalid format in {partial_path}: 'records' must be a list.")

    seen_pairs: set[tuple[str, str]] = set()
    for idx, r in enumerate(records):
        if not isinstance(r, dict):
            raise ValueError(f"Record at index {idx} in {partial_path} is not a valid JSON object.")
        cid = r.get("case_id")
        m = r.get("mode")
        if not cid or not m:
            raise ValueError(
                f"Record at index {idx} in {partial_path} is missing required 'case_id' or 'mode' field."
            )
        if cid not in valid_case_ids:
            raise ValueError(
                f"Record at index {idx} has case_id '{cid}' which is not in the active dataset."
            )
        if m not in valid_modes:
            raise ValueError(
                f"Record at index {idx} has mode '{m}' which is not among the requested evaluation modes {valid_modes}."
            )
        pair = (cid, m)
        if pair in seen_pairs:
            raise ValueError(
                f"Duplicate record detected for case '{cid}' and mode '{m}' in {partial_path}."
            )
        seen_pairs.add(pair)

    return run_dir, records


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main() -> int:
    parser = argparse.ArgumentParser(description="Run the research evaluation")
    parser.add_argument("--dataset", type=str, default=str(DEFAULT_DATASET_PATH), help="Path to evaluation dataset JSON")
    parser.add_argument("--resume", type=str, default=None, help="Resume an interrupted evaluation run by its RUN_ID")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of cases")
    parser.add_argument("--modes", type=str, default=",".join(MODES))
    parser.add_argument("--no-ablation", action="store_true")
    args = parser.parse_args()

    dataset_path = Path(args.dataset).resolve()
    if not dataset_path.exists():
        print(f"Error: Dataset file not found at {dataset_path}", file=sys.stderr)
        return 1

    dataset = json.loads(dataset_path.read_text(encoding="utf-8"))
    schema_errors = validate_dataset_schema(dataset)
    if schema_errors:
        print(f"Warning: Dataset schema issues detected: {schema_errors}", file=sys.stderr)

    cases = dataset["cases"][: args.limit] if args.limit else dataset["cases"]
    modes = [m.strip() for m in args.modes.split(",") if m.strip()]
    valid_case_ids = {c["case_id"] for c in cases}

    if args.resume:
        try:
            out_dir, records = validate_and_load_resume(
                args.resume,
                RESULTS_ROOT,
                valid_case_ids,
                modes,
            )
            run_id = args.resume
        except ValueError as err:
            print(f"Error resuming run: {err}", file=sys.stderr)
            return 1
        print(f"Resuming run {run_id}: loaded {len(records)} existing completed records from {out_dir / 'results_partial.json'}")
    else:
        run_id = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:6]
        out_dir = RESULTS_ROOT / run_id
        out_dir.mkdir(parents=True, exist_ok=True)
        records = []

    print(f"Dataset: {dataset_path} ({dataset.get('dataset_version', 'unknown')}, {len(cases)} cases, synthetic: {dataset.get('synthetic', True)})")
    print(f"Modes: {modes}")
    print(f"Results dir: {out_dir}")

    # Seed alerts first (real DB records, idempotent).
    alert_ids = {}
    for case in cases:
        alert_ids[case["case_id"]] = await seed_alert(case)
    print(f"Seeded/verified alert ids for {len(alert_ids)} cases.")

    orchestrator = build_orchestrator()
    completed_pairs = {(r["case_id"], r["mode"]) for r in records}
    total_pairs = len(cases) * len(modes)
    done = len(records)
    print(f"Total workload: {total_pairs} evaluations ({done} already completed, {total_pairs - done} remaining).", flush=True)

    for case in cases:
        for mode in modes:
            pair = (case["case_id"], mode)
            if pair in completed_pairs:
                continue
            done += 1
            print(f"[{done}/{total_pairs}] {case['case_id']} x {mode} ...", flush=True)
            record = await run_one(case, alert_ids[case["case_id"]], mode, orchestrator)
            records.append(record)
            completed_pairs.add(pair)
            lat = record.get("wall_latency_seconds", 0)
            err = f" ERROR {record['error']}" if record.get("error") else ""
            print(f"    done in {lat:.1f}s{err}", flush=True)
            # checkpoint after every run
            (out_dir / "results_partial.json").write_text(
                json.dumps({"run_id": run_id, "records": records}, indent=2),
                encoding="utf-8",
            )

    agg = aggregate(records)

    ablation = None
    if not args.no_ablation:
        print("Running retrieval-only ablation (no LLM) ...", flush=True)
        ablation = await run_ablation(dataset, alert_ids)
        (out_dir / "ablation.json").write_text(json.dumps(ablation, indent=2), encoding="utf-8")

    meta = {
        "run_id": run_id,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "dataset_version": dataset.get("dataset_version", "unknown"),
        "dataset_path": str(dataset_path),
        "synthetic": dataset.get("synthetic", True),
        "num_cases": len(cases),
        "llm_model": settings.LLM_MODEL,
        "llm_base_url": settings.LLM_BASE_URL,
        "embedding_model": SemanticEmbeddingProvider(
            model_id=settings.SEMANTIC_EMBEDDING_MODEL
        ).model_name,
        "qdrant_collection": settings.QDRANT_COLLECTION,
        "modes": modes,
        "temperature": 0.0,
    }

    results_doc = {"meta": meta, "aggregate": agg, "records": records}
    (out_dir / "results.json").write_text(json.dumps(results_doc, indent=2), encoding="utf-8")
    write_csv(records, out_dir / "results.csv")
    write_report(agg, ablation, meta, records, out_dir / "report.md")

    # 'latest' pointer for the frontend/API
    (RESULTS_ROOT / "latest.json").write_text(
        json.dumps({
            "run_id": run_id,
            "dir": str(out_dir),
            "dataset_version": dataset.get("dataset_version", "unknown"),
            "timestamp_utc": meta["timestamp_utc"]
        }, indent=2),
        encoding="utf-8"
    )

    print(f"\nAggregates: {json.dumps(agg, indent=2, default=str)}")
    print(f"\nResults written to {out_dir}")

    # Dispose pooled DB connections cleanly before interpreter exit.
    from app.db.database import engine
    await engine.dispose()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
