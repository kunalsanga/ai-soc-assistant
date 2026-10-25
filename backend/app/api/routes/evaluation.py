from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(tags=["evaluation"])


def _results_dir() -> Path:
    base = Path(__file__).resolve().parent.parent.parent.parent / "evaluation" / "results"
    return base.resolve()


def _eval_dir() -> Path:
    base = Path(__file__).resolve().parent.parent.parent.parent / "evaluation"
    return base.resolve()


_SAFE_ID_RE = re.compile(r"^[a-zA-Z0-9_\-]+$")


def _load_run_data(run_path: Path, limit: int = 100) -> Dict[str, Any]:
    if not run_path.exists():
        raise HTTPException(status_code=404, detail=f"Evaluation run dir not found: {run_path.name}")

    results_json = run_path / "results.json"
    results_partial = run_path / "results_partial.json"
    results_csv = run_path / "results.csv"
    report_md = run_path / "report.md"

    is_partial = False
    target_json = results_json
    if not target_json.exists():
        if results_partial.exists():
            target_json = results_partial
            is_partial = True
        else:
            raise HTTPException(status_code=404, detail=f"No results found in {run_path.name}")

    try:
        with target_json.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read evaluation JSON: {e}")

    report = report_md.read_text(encoding="utf-8") if report_md.exists() else None
    csv_text = results_csv.read_text(encoding="utf-8") if results_csv.exists() else None

    meta = data.get("meta", {})
    if is_partial:
        meta["status"] = "partial"
    else:
        meta["status"] = "completed"

    records = data.get("records", [])
    total_records = len(records)

    return {
        "run_id": run_path.name,
        "timestamp_utc": meta.get("timestamp_utc"),
        "dir": str(run_path),
        "status": meta["status"],
        "meta": meta,
        "aggregate": data.get("aggregate", {}),
        "total_records": total_records,
        "records": records[:limit],
        "report": report,
        "csv": csv_text,
    }


@router.get("/latest")
def get_latest_evaluation(limit: int = Query(default=100, ge=1, le=500)) -> Dict[str, Any]:
    """Retrieve the latest completed evaluation run."""
    dir_path = _results_dir()
    latest_file = dir_path / "latest.json"
    if not latest_file.exists():
        raise HTTPException(status_code=404, detail="No evaluation run found")
    try:
        with latest_file.open("r", encoding="utf-8") as f:
            meta = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read latest.json: {e}")

    run_id = meta.get("run_id")
    if not run_id or not _SAFE_ID_RE.match(run_id):
        raise HTTPException(status_code=500, detail="Invalid latest.json: missing or unsafe run_id")

    candidate = dir_path / run_id
    if not candidate.exists() or not candidate.is_dir():
        run_dir = meta.get("dir")
        if run_dir:
            candidate = Path(run_dir)

    return _load_run_data(candidate, limit=limit)


@router.get("/runs")
def list_evaluation_runs() -> List[Dict[str, Any]]:
    """List historical evaluation runs stored on disk."""
    dir_path = _results_dir()
    if not dir_path.exists():
        return []

    runs: List[Dict[str, Any]] = []
    for item in dir_path.iterdir():
        if not item.is_dir():
            continue
        run_id = item.name
        if not _SAFE_ID_RE.match(run_id):
            continue

        results_json = item / "results.json"
        partial_json = item / "results_partial.json"

        if results_json.exists():
            status = "completed"
            try:
                with results_json.open("r", encoding="utf-8") as f:
                    doc = json.load(f)
                meta = doc.get("meta", {})
                agg = doc.get("aggregate", {})
                runs.append({
                    "run_id": run_id,
                    "timestamp_utc": meta.get("timestamp_utc"),
                    "dataset_version": meta.get("dataset_version", "unknown"),
                    "num_cases": meta.get("num_cases", 0),
                    "modes": meta.get("modes", []),
                    "status": status,
                    "llm_model": meta.get("llm_model"),
                    "synthetic": meta.get("synthetic", True),
                    "modes_evaluated": list(agg.keys()),
                })
            except Exception:
                continue
        elif partial_json.exists():
            status = "partial"
            try:
                with partial_json.open("r", encoding="utf-8") as f:
                    doc = json.load(f)
                runs.append({
                    "run_id": run_id,
                    "timestamp_utc": None,
                    "dataset_version": "unknown",
                    "num_cases": len(doc.get("records", [])),
                    "modes": [],
                    "status": status,
                    "llm_model": None,
                    "synthetic": True,
                    "modes_evaluated": [],
                })
            except Exception:
                continue

    # Sort newest first by run_id (which starts with timestamp YYYYMMDD-HHMMSS)
    runs.sort(key=lambda r: r["run_id"], reverse=True)
    return runs


@router.get("/runs/{run_id}")
def get_evaluation_run(run_id: str, limit: int = Query(default=100, ge=1, le=500)) -> Dict[str, Any]:
    """Retrieve details for a specific evaluation run."""
    if not _SAFE_ID_RE.match(run_id):
        raise HTTPException(status_code=400, detail="Invalid run_id format")

    run_path = _results_dir() / run_id
    return _load_run_data(run_path, limit=limit)


@router.get("/datasets")
def list_datasets() -> List[Dict[str, Any]]:
    """List available benchmark datasets with category and scenario breakdowns."""
    eval_dir = _eval_dir()
    if not eval_dir.exists():
        return []

    datasets: List[Dict[str, Any]] = []
    for file_path in eval_dir.glob("dataset_*.json"):
        try:
            with file_path.open("r", encoding="utf-8") as f:
                d = json.load(f)
            cases = d.get("cases", [])
            categories = sorted(list({c.get("category", "unknown") for c in cases}))
            benign_count = sum(1 for c in cases if (c.get("ground_truth") or {}).get("is_benign"))
            attack_count = len(cases) - benign_count

            datasets.append({
                "filename": file_path.name,
                "dataset_version": d.get("dataset_version", "unknown"),
                "description": d.get("description", ""),
                "synthetic": d.get("synthetic", True),
                "num_cases": len(cases),
                "categories": categories,
                "benign_cases": benign_count,
                "attack_cases": attack_count,
            })
        except Exception:
            continue

    datasets.sort(key=lambda x: x["dataset_version"], reverse=True)
    return datasets
