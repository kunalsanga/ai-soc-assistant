"""Research evaluation package (Milestone 3).

Provides metrics and dataset helpers used by scripts/run_evaluation.py.
The evaluation reuses the production orchestrator — no separate competing
pipeline exists.
"""
from app.evaluation.metrics import (
    extract_severity_band,
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
)

__all__ = [
    "extract_severity_band",
    "extract_techniques",
    "mean",
    "median",
    "mrr",
    "rank_of_first_relevant",
    "recall_at_k",
    "severity_band_match",
    "stdev",
    "technique_prf1",
    "valid_evidence_reference_rate",
]
