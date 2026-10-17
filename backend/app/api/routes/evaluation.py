from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException

from app.core.config import settings

router = APIRouter(tags=["evaluation"])


def _results_dir() -> Path:
    base = Path(__file__).resolve().parent.parent.parent.parent / "evaluation" / "results"
    return base.resolve()


@router.get("/latest")
def get_latest_evaluation() -> Dict[str, Any]:
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
    run_dir = meta.get("dir")
    if run_id:
        candidate = dir_path / run_id
        if candidate.exists() and candidate.is_dir():
            run_dir = str(candidate)
    if not run_dir:
        raise HTTPException(status_code=500, detail="Invalid latest.json: missing run dir")

    run_path = Path(run_dir)
    if not run_path.exists():
        raise HTTPException(status_code=404, detail=f"Evaluation run dir not found: {run_path}")

    results_json = run_path / "results.json"
    results_csv = run_path / "results.csv"
    report_md = run_path / "report.md"

    try:
        with results_json.open("r", encoding="utf-8") as f:
            results = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read results.json: {e}")

    report = report_md.read_text(encoding="utf-8") if report_md.exists() else None
    csv_text = results_csv.read_text(encoding="utf-8") if results_csv.exists() else None

    return {
        "run_id": meta.get("run_id"),
        "timestamp_utc": meta.get("timestamp_utc"),
        "dir": str(run_path),
        "meta": results.get("meta", {}),
        "aggregate": results.get("aggregate", {}),
        "records": results.get("records", [])[:20],  # truncated for UI
        "report": report,
        "csv": csv_text,
    }
