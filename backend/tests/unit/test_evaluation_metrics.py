"""Unit tests for evaluation metrics and dataset loading (Milestone 3.6)."""
import json
from pathlib import Path

import pytest

from app.evaluation.metrics import (
    benign_evaluation,
    cve_prf1,
    extract_cves,
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
    validate_dataset_schema,
)

DATASET_PATH = Path(__file__).resolve().parents[2] / "evaluation" / "dataset_v1.json"


class TestBasicStats:
    def test_mean_median_stdev(self):
        assert mean([1.0, 2.0, 3.0]) == pytest.approx(2.0)
        assert median([1.0, 2.0, 3.0, 4.0]) == pytest.approx(2.5)
        assert median([5.0]) == pytest.approx(5.0)
        assert stdev([2.0, 4.0, 4.0, 4.0, 5.0, 5.0, 7.0, 9.0]) == pytest.approx(2.138, abs=1e-3)
        assert mean([]) is None
        assert stdev([1.0]) is None


class TestSeverityBand:
    def test_extraction(self):
        assert extract_severity_band("Critical: active compromise") == "critical"
        assert extract_severity_band("This is a HIGH severity event") == "high"
        assert extract_severity_band("moderate risk of lateral movement") == "medium"
        assert extract_severity_band("low likelihood, informational only") == "low"
        assert extract_severity_band("The alert fired on host web-01") is None
        assert extract_severity_band("") is None
        assert extract_severity_band(None) is None

    def test_match(self):
        assert severity_band_match("critical incident response", "critical") is True
        assert severity_band_match("high severity", "critical") is False
        assert severity_band_match("no band here", "high") is None  # unparseable
        assert severity_band_match("anything", None) is None


class TestTechniques:
    def test_extraction(self):
        assert extract_techniques("Uses T1110 and later T1059.001") == ["T1110", "T1059.001"]
        assert extract_techniques("no ids here") == []
        assert extract_techniques(None) == []
        # dedupe, keep order
        assert extract_techniques("T1110 then T1110 again") == ["T1110"]

    def test_prf1_exact(self):
        r = technique_prf1(["T1110", "T1110.001", "T9999"], {"T1110", "T1110.001"})
        assert r["precision"] == pytest.approx(2 / 3)
        assert r["recall"] == pytest.approx(1.0)
        assert r["f1"] == pytest.approx(0.8, abs=1e-6)

    def test_prf1_empty_prediction(self):
        r = technique_prf1([], {"T1110"})
        assert r["precision"] == 0.0
        assert r["recall"] == 0.0
        assert r["f1"] == 0.0

    def test_prf1_no_expected(self):
        r = technique_prf1(["T1110"], set())
        assert r["precision"] is None and r["recall"] is None and r["f1"] is None


class TestRetrievalMetrics:
    def test_rank_of_first_relevant(self):
        assert rank_of_first_relevant(["T9999", "T1110", "T1046"], {"T1110"}) == 2
        assert rank_of_first_relevant(["T9999"], {"T1110"}) is None

    def test_recall_at_k_counts_misses(self):
        # 2 hits within k=5 out of 4 total queries (1 miss, 1 no-result)
        ranks = [1, 3, None, 9]
        assert recall_at_k(ranks, 5) == pytest.approx(0.5)
        assert recall_at_k(ranks, 1) == pytest.approx(0.25)

    def test_mrr(self):
        assert mrr([1, 3]) == pytest.approx((1.0 + 1 / 3) / 2)
        assert mrr([None, None]) == 0.0


class TestGrounding:
    def test_rate(self):
        assert valid_evidence_reference_rate([], {"a"}) is None  # nothing to grade
        assert valid_evidence_reference_rate(["a", "b"], {"a"}) == pytest.approx(0.5)
        assert valid_evidence_reference_rate(["x"], set()) == 0.0
        assert valid_evidence_reference_rate(["a", "a", "zzz"], {"a", "b"}) == pytest.approx(2 / 3)


class TestDataset:
    def test_dataset_loads_and_is_wellformed(self):
        dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
        assert dataset["dataset_version"] == "v1"
        assert len(dataset["cases"]) >= 8
        for case in dataset["cases"]:
            alert = case["alert"]
            gt = case["ground_truth"]
            # structural checks: external id convention eval-00X from case-0X-slug
            assert alert["id"] == f"eval-{int(case['case_id'].split('-')[1]):03d}"
            assert alert["rule"]["level"] >= 1
            assert gt["expected_severity_band"] in {"low", "medium", "high", "critical"}
            assert len(gt["expected_techniques"]) > 0
            assert all(t.startswith("T") for t in gt["expected_techniques"])
            assert len(gt["relevant_knowledge_ids"]) > 0
            assert len(gt["expected_indicators"]) > 0
            assert gt["expected_direction"].strip()

class TestCVEMetrics:
    def test_extract_cves(self):
        assert extract_cves("Exploits CVE-2021-44228 and cve-2022-22965") == ["CVE-2021-44228", "CVE-2022-22965"]
        assert extract_cves("No vulnerabilities mentioned here") == []
        assert extract_cves("") == []
        assert extract_cves(None) == []

    def test_cve_prf1_empty_both(self):
        # Neither expected nor predicted -> True Negative, 1.0 accuracy
        r = cve_prf1([], set())
        assert r["precision"] == 1.0
        assert r["recall"] == 1.0
        assert r["f1"] == 1.0

    def test_cve_prf1_hallucinated(self):
        # None expected, but predicted -> Precision 0, F1 0
        r = cve_prf1(["CVE-2021-44228"], set())
        assert r["precision"] == 0.0
        assert r["recall"] == 0.0
        assert r["f1"] == 0.0

    def test_cve_prf1_matching(self):
        r = cve_prf1(["CVE-2021-44228"], {"CVE-2021-44228"})
        assert r["precision"] == 1.0
        assert r["recall"] == 1.0
        assert r["f1"] == 1.0


class TestBenignEvaluation:
    def test_benign_true_negative(self):
        r = benign_evaluation("Low severity benign scan", is_benign=True, expected_band="low")
        assert r["is_benign"] is True
        assert r["is_false_alarm"] is False
        assert r["correctly_benign"] is True

    def test_benign_false_alarm(self):
        r = benign_evaluation("CRITICAL active attack", is_benign=True, expected_band="low")
        assert r["is_benign"] is True
        assert r["is_false_alarm"] is True
        assert r["correctly_benign"] is False

    def test_attack_scenario(self):
        r = benign_evaluation("Critical compromise", is_benign=False, expected_band="critical")
        assert r["is_benign"] is False
        assert r["is_false_alarm"] is None


class TestDatasetV2:
    DATASET_V2_PATH = Path(__file__).resolve().parents[2] / "evaluation" / "dataset_v2.json"

    def test_dataset_v2_schema_validation(self):
        from app.evaluation.metrics import validate_dataset_schema
        dataset = json.loads(self.DATASET_V2_PATH.read_text(encoding="utf-8"))
        errors = validate_dataset_schema(dataset)
        assert errors == [], f"Validation errors: {errors}"
        assert dataset["dataset_version"] == "v2"
        assert dataset["synthetic"] is True
        assert len(dataset["cases"]) == 40

    def test_category_and_benign_coverage(self):
        dataset = json.loads(self.DATASET_V2_PATH.read_text(encoding="utf-8"))
        cases = dataset["cases"]
        categories = {c["category"] for c in cases}
        assert len(categories) == 10, f"Expected 10 categories, got: {categories}"

        benign_cases = [c for c in cases if c["ground_truth"]["is_benign"]]
        assert len(benign_cases) == 4
        for bc in benign_cases:
            assert bc["ground_truth"]["expected_severity_band"] == "low"
            assert bc["ground_truth"]["expected_techniques"] == []

        attack_cases = [c for c in cases if not c["ground_truth"]["is_benign"]]
        assert len(attack_cases) == 36
        for ac in attack_cases:
            assert len(ac["ground_truth"]["expected_techniques"]) > 0

    def test_log4shell_cve_mapping(self):
        dataset = json.loads(self.DATASET_V2_PATH.read_text(encoding="utf-8"))
        log4j = next(c for c in dataset["cases"] if c["case_id"] == "case-29-log4shell-exploitation")
        assert "CVE-2021-44228" in log4j["ground_truth"]["expected_cves"]
        assert log4j["ground_truth"]["expected_severity_band"] == "critical"

