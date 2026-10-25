"""Research evaluation metrics.

Pure, deterministic functions. Every metric is computed from recorded
artifacts — nothing is estimated or fabricated. Where a metric cannot be
computed (missing data), the function returns None explicitly so reports can
state coverage honestly instead of inventing a score.
"""
from __future__ import annotations

import re
from typing import Dict, Iterable, List, Optional, Sequence, Set

_SEVERITY_BANDS = ("critical", "high", "medium", "low")

_TECHNIQUE_RE = re.compile(r"\bT\d{4}(?:\.\d{3})?\b")

# Order matters: longest first so "critical" is not matched inside "criticality".
_BAND_RE = re.compile(
    r"\b(critical|critically|high|elevated|medium|moderate|low|informational)\b",
    re.IGNORECASE,
)
_BAND_ALIASES = {
    "critically": "critical",
    "elevated": "high",
    "moderate": "medium",
    "informational": "low",
}


def mean(values: Sequence[float]) -> Optional[float]:
    return sum(values) / len(values) if values else None


def median(values: Sequence[float]) -> Optional[float]:
    if not values:
        return None
    ordered = sorted(values)
    n = len(ordered)
    mid = n // 2
    if n % 2 == 1:
        return float(ordered[mid])
    return (ordered[mid - 1] + ordered[mid]) / 2.0


def stdev(values: Sequence[float]) -> Optional[float]:
    n = len(values)
    if n < 2:
        return None
    m = sum(values) / n
    return (sum((v - m) ** 2 for v in values) / (n - 1)) ** 0.5


def extract_severity_band(text: Optional[str]) -> Optional[str]:
    """Extract a severity band word from free text. None if none present."""
    if not text:
        return None
    match = _BAND_RE.search(text)
    if not match:
        return None
    word = match.group(1).lower()
    return _BAND_ALIASES.get(word, word)


def severity_band_match(
    predicted_text: Optional[str], expected_band: Optional[str]
) -> Optional[bool]:
    """True/False when the predicted text yields a band; None when unparseable."""
    if not expected_band:
        return None
    band = extract_severity_band(predicted_text)
    if band is None:
        return None
    return band == expected_band.lower()


def extract_techniques(text: Optional[str]) -> List[str]:
    """Extract MITRE technique ids mentioned in text (deduped, order kept)."""
    if not text:
        return []
    return list(dict.fromkeys(_TECHNIQUE_RE.findall(text)))


def technique_prf1(
    predicted: Iterable[str], expected: Set[str]
) -> Dict[str, Optional[float]]:
    """Exact-match precision/recall/F1 over technique-id sets.

    Returns None-valued metrics when there is nothing to compare (explicitly
    reported as zero-coverage rather than fabricated).
    """
    predicted_set = {t.strip().upper() for t in predicted if t}
    if not expected:
        return {"precision": None, "recall": None, "f1": None, "predicted_count": len(predicted_set)}
    tp = len(predicted_set & expected)
    # Zero-division convention (sklearn zero_division=0): empty predictions
    # yield precision 0 — a real miss, never treated as full coverage.
    precision = tp / len(predicted_set) if predicted_set else 0.0
    recall = tp / len(expected)
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
    return {
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "predicted_count": len(predicted_set),
    }


def rank_of_first_relevant(
    ranked_identifiers: Sequence[str], relevant: Set[str]
) -> Optional[int]:
    """1-based rank of the first relevant identifier, or None."""
    for rank, identifier in enumerate(ranked_identifiers, start=1):
        if identifier in relevant:
            return rank
    return None


def recall_at_k(ranks: Sequence[Optional[int]], k: int, total_cases: Optional[int] = None) -> Optional[float]:
    """Fraction of queries whose first relevant result is within rank k.

    total_cases defaults to len(ranks); cases with no results still count as
    misses (they are real failures, not exclusions).
    """
    denom = total_cases if total_cases is not None else len(ranks)
    if not denom:
        return None
    hits = sum(1 for r in ranks if r is not None and r <= k)
    return hits / denom


def mrr(ranks: Sequence[Optional[int]]) -> Optional[float]:
    if not ranks:
        return None
    rr = [1.0 / r for r in ranks if r is not None]
    return sum(rr) / len(ranks)


def valid_evidence_reference_rate(
    all_reference_ids: Sequence[str], valid_reference_ids: Set[str]
) -> Optional[float]:
    """Fraction of LLM evidence references that exist in the evidence set.

    Returns None when the LLM produced no references at all (nothing to
    grade — reported as zero coverage, never as 100%).
    """
    if not all_reference_ids:
        return None
    if not valid_reference_ids:
        return 0.0
    valid = sum(1 for r in all_reference_ids if r in valid_reference_ids)
    return valid / len(all_reference_ids)


_CVE_RE = re.compile(r"\bCVE-\d{4}-\d{4,7}\b", re.IGNORECASE)


def extract_cves(text: Optional[str]) -> List[str]:
    """Extract CVE identifiers mentioned in text (deduped, uppercase)."""
    if not text:
        return []
    matches = [m.upper() for m in _CVE_RE.findall(text)]
    return list(dict.fromkeys(matches))


def cve_prf1(
    predicted: Iterable[str], expected: Set[str]
) -> Dict[str, Optional[float]]:
    """Precision, recall, and F1 for predicted CVEs against expected CVEs.

    Defined mathematical conventions:
    - If expected is empty and predicted is empty: 1.0 (correctly identified no CVE).
    - If expected is empty and predicted is non-empty: precision 0.0, recall 0.0, f1 0.0 (hallucinated uncalled-for CVE).
    - If expected is non-empty and predicted is empty: precision 0.0, recall 0.0, f1 0.0 (missed expected CVE).
    - If expected is non-empty and predicted is non-empty: standard set-based precision/recall/F1.
    """
    pred_set = {c.strip().upper() for c in predicted if c}
    exp_set = {c.strip().upper() for c in expected if c}

    if not exp_set:
        if not pred_set:
            return {
                "precision": 1.0,
                "recall": 1.0,
                "f1": 1.0,
                "predicted_count": 0,
                "expected_count": 0,
            }
        return {
            "precision": 0.0,
            "recall": 0.0,
            "f1": 0.0,
            "predicted_count": len(pred_set),
            "expected_count": 0,
        }

    tp = len(pred_set & exp_set)
    precision = tp / len(pred_set) if pred_set else 0.0
    recall = tp / len(exp_set)
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

    return {
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "predicted_count": len(pred_set),
        "expected_count": len(exp_set),
    }


def benign_evaluation(
    predicted_text: Optional[str],
    is_benign: bool,
    expected_band: Optional[str] = "low"
) -> Dict[str, Any]:
    """Evaluate performance specifically for benign / negative control scenarios.

    An alert marked is_benign=True should ideally NOT trigger high/critical alarms.
    - is_false_alarm: True if a benign event is classified as high or critical.
    - correctly_benign: True if a benign event is classified as low or medium.
    """
    band = extract_severity_band(predicted_text)
    if not is_benign:
        return {
            "is_benign": False,
            "is_false_alarm": None,
            "correctly_benign": None,
            "predicted_band": band,
        }

    is_false_alarm = band in {"high", "critical"} if band else False
    correctly_benign = band in {"low", "medium"} if band else None

    return {
        "is_benign": True,
        "is_false_alarm": is_false_alarm,
        "correctly_benign": correctly_benign,
        "predicted_band": band,
    }


def validate_dataset_schema(dataset: dict) -> List[str]:
    """Validate dataset structure, schema integrity, and ground-truth conventions.

    Returns a list of error strings; empty list indicates complete compliance.
    """
    errors: List[str] = []
    if not isinstance(dataset, dict):
        return ["Dataset must be a JSON object"]

    version = dataset.get("dataset_version")
    if not version or not isinstance(version, str):
        errors.append("Missing or invalid 'dataset_version'")

    cases = dataset.get("cases")
    if not isinstance(cases, list) or len(cases) == 0:
        return ["Dataset 'cases' must be a non-empty list"]

    seen_case_ids: Set[str] = set()
    seen_alert_ids: Set[str] = set()

    for idx, c in enumerate(cases):
        prefix = f"Case [{idx}]"
        case_id = c.get("case_id")
        if not case_id or not isinstance(case_id, str):
            errors.append(f"{prefix}: Missing or invalid 'case_id'")
        elif case_id in seen_case_ids:
            errors.append(f"{prefix}: Duplicate case_id '{case_id}'")
        else:
            seen_case_ids.add(case_id)

        alert = c.get("alert")
        if not isinstance(alert, dict):
            errors.append(f"{prefix} ({case_id}): Missing 'alert' object")
            continue

        alert_id = alert.get("id")
        if not alert_id or not isinstance(alert_id, str):
            errors.append(f"{prefix} ({case_id}): Missing alert 'id'")
        elif alert_id in seen_alert_ids:
            errors.append(f"{prefix} ({case_id}): Duplicate alert id '{alert_id}'")
        else:
            seen_alert_ids.add(alert_id)

        rule = alert.get("rule")
        if not isinstance(rule, dict) or "level" not in rule:
            errors.append(f"{prefix} ({case_id}): Alert missing rule level")

        gt = c.get("ground_truth")
        if not isinstance(gt, dict):
            errors.append(f"{prefix} ({case_id}): Missing 'ground_truth' object")
            continue

        band = gt.get("expected_severity_band")
        if band not in {"low", "medium", "high", "critical"}:
            errors.append(f"{prefix} ({case_id}): Invalid expected_severity_band '{band}'")

        if "is_benign" not in gt:
            errors.append(f"{prefix} ({case_id}): Ground truth missing 'is_benign'")

        if "expected_techniques" not in gt or not isinstance(gt["expected_techniques"], list):
            errors.append(f"{prefix} ({case_id}): Missing 'expected_techniques' list")

        if "expected_cves" in gt and not isinstance(gt["expected_cves"], list):
            errors.append(f"{prefix} ({case_id}): 'expected_cves' must be a list if present")

    return errors

