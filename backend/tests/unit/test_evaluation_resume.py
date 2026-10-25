import json
from pathlib import Path
import pytest

from scripts.run_evaluation import validate_and_load_resume


class TestEvaluationResumeValidation:
    VALID_CASES = {"case-01-ssh", "case-02-spray", "case-03-web"}
    VALID_MODES = ["llm_only", "standard_rag", "evidence_aware"]

    def test_invalid_run_id_format(self, tmp_path: Path):
        for bad_id in ["../run-01", "run 01", "run/01", "run;01", "run$01"]:
            with pytest.raises(ValueError, match="Invalid run ID format"):
                validate_and_load_resume(bad_id, tmp_path, self.VALID_CASES, self.VALID_MODES)

    def test_run_dir_not_found(self, tmp_path: Path):
        with pytest.raises(ValueError, match="Resume run directory does not exist"):
            validate_and_load_resume("nonexistent-run-123", tmp_path, self.VALID_CASES, self.VALID_MODES)

    def test_missing_partial_file(self, tmp_path: Path):
        run_dir = tmp_path / "run-empty"
        run_dir.mkdir()
        with pytest.raises(ValueError, match="partial checkpoint file not found"):
            validate_and_load_resume("run-empty", tmp_path, self.VALID_CASES, self.VALID_MODES)

    def test_corrupt_json(self, tmp_path: Path):
        run_dir = tmp_path / "run-corrupt"
        run_dir.mkdir()
        (run_dir / "results_partial.json").write_text("{ corrupt json ...", encoding="utf-8")
        with pytest.raises(ValueError, match="Corrupt or unreadable JSON"):
            validate_and_load_resume("run-corrupt", tmp_path, self.VALID_CASES, self.VALID_MODES)

    def test_not_a_json_object(self, tmp_path: Path):
        run_dir = tmp_path / "run-list"
        run_dir.mkdir()
        (run_dir / "results_partial.json").write_text("[]", encoding="utf-8")
        with pytest.raises(ValueError, match="top-level element must be a JSON object"):
            validate_and_load_resume("run-list", tmp_path, self.VALID_CASES, self.VALID_MODES)

    def test_run_id_mismatch(self, tmp_path: Path):
        run_dir = tmp_path / "run-mismatch"
        run_dir.mkdir()
        content = {"run_id": "other-run-999", "records": []}
        (run_dir / "results_partial.json").write_text(json.dumps(content), encoding="utf-8")
        with pytest.raises(ValueError, match="Run ID mismatch"):
            validate_and_load_resume("run-mismatch", tmp_path, self.VALID_CASES, self.VALID_MODES)

    def test_unknown_case_id(self, tmp_path: Path):
        run_dir = tmp_path / "run-unknown-case"
        run_dir.mkdir()
        content = {
            "run_id": "run-unknown-case",
            "records": [{"case_id": "case-99-fake", "mode": "llm_only"}],
        }
        (run_dir / "results_partial.json").write_text(json.dumps(content), encoding="utf-8")
        with pytest.raises(ValueError, match="not in the active dataset"):
            validate_and_load_resume("run-unknown-case", tmp_path, self.VALID_CASES, self.VALID_MODES)

    def test_unknown_mode(self, tmp_path: Path):
        run_dir = tmp_path / "run-unknown-mode"
        run_dir.mkdir()
        content = {
            "run_id": "run-unknown-mode",
            "records": [{"case_id": "case-01-ssh", "mode": "future_ai_mode"}],
        }
        (run_dir / "results_partial.json").write_text(json.dumps(content), encoding="utf-8")
        with pytest.raises(ValueError, match="not among the requested evaluation modes"):
            validate_and_load_resume("run-unknown-mode", tmp_path, self.VALID_CASES, self.VALID_MODES)

    def test_duplicate_records(self, tmp_path: Path):
        run_dir = tmp_path / "run-duplicate"
        run_dir.mkdir()
        content = {
            "run_id": "run-duplicate",
            "records": [
                {"case_id": "case-01-ssh", "mode": "llm_only"},
                {"case_id": "case-01-ssh", "mode": "llm_only"},
            ],
        }
        (run_dir / "results_partial.json").write_text(json.dumps(content), encoding="utf-8")
        with pytest.raises(ValueError, match="Duplicate record detected"):
            validate_and_load_resume("run-duplicate", tmp_path, self.VALID_CASES, self.VALID_MODES)

    def test_successful_resume_load(self, tmp_path: Path):
        run_dir = tmp_path / "run-valid"
        run_dir.mkdir()
        valid_records = [
            {"case_id": "case-01-ssh", "mode": "llm_only", "wall_latency_seconds": 12.0},
            {"case_id": "case-01-ssh", "mode": "evidence_aware", "wall_latency_seconds": 15.0},
        ]
        content = {"run_id": "run-valid", "records": valid_records}
        (run_dir / "results_partial.json").write_text(json.dumps(content), encoding="utf-8")

        loaded_dir, loaded_records = validate_and_load_resume(
            "run-valid", tmp_path, self.VALID_CASES, self.VALID_MODES
        )
        assert loaded_dir == run_dir
        assert len(loaded_records) == 2
        assert loaded_records[0]["case_id"] == "case-01-ssh"
        assert loaded_records[0]["mode"] == "llm_only"

    def test_skipping_completed_pairs_logic(self):
        # Simulates the runner's skip logic
        existing_records = [
            {"case_id": "case-01-ssh", "mode": "llm_only"},
            {"case_id": "case-01-ssh", "mode": "standard_rag"},
        ]
        completed_pairs = {(r["case_id"], r["mode"]) for r in existing_records}

        cases = [{"case_id": "case-01-ssh"}, {"case_id": "case-02-spray"}]
        modes = ["llm_only", "standard_rag"]

        pairs_to_execute = []
        for case in cases:
            for mode in modes:
                pair = (case["case_id"], mode)
                if pair in completed_pairs:
                    continue
                pairs_to_execute.append(pair)

        # Expected: case-01-ssh pairs skipped, only case-02-spray executed
        assert pairs_to_execute == [
            ("case-02-spray", "llm_only"),
            ("case-02-spray", "standard_rag"),
        ]
