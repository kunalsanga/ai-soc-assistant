"""Regression tests for benchmark data integrity and cross-dataset isolation.

Verifies:
1. Dataset v1 and Dataset v2 alert IDs cannot collide or contaminate each other.
2. The correct alert content and ground-truth labels are aligned for every scenario.
3. Alert ID namespacing is deterministic and backwards-compatible.
4. Seeding logic is idempotent, handles schema updates, and enriches provenance.
5. Benchmark dataset schemas adhere to ground-truth invariants.
"""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Import wazuh.service BEFORE security.normalization to avoid circular import
from app.wazuh.service import AlertService  # isort: skip
from app.evaluation.metrics import validate_dataset_schema
from app.security.normalization import normalize_wazuh_alert
from scripts.run_evaluation import get_namespaced_alert_id, seed_alert

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
DATASET_V1_PATH = BACKEND_DIR / "evaluation" / "dataset_v1.json"
DATASET_V2_PATH = BACKEND_DIR / "evaluation" / "dataset_v2.json"


# ---------------------------------------------------------------------------
# 1. Alert ID Namespacing & Isolation
# ---------------------------------------------------------------------------

def test_namespaced_alert_id_isolation():
    """Verify that dataset versions produce isolated alert IDs."""
    # Historical v1 compatibility
    assert get_namespaced_alert_id("eval-001", "v1") == "eval-001"
    assert get_namespaced_alert_id("eval-003", "v1") == "eval-003"

    # v2 prefixing
    assert get_namespaced_alert_id("eval-001", "v2") == "v2-eval-001"
    assert get_namespaced_alert_id("eval-003", "v2") == "v2-eval-003"
    assert get_namespaced_alert_id("eval-040", "v2") == "v2-eval-040"

    # Future versions
    assert get_namespaced_alert_id("eval-001", "v3") == "v3-eval-001"

    # Avoid double-prefixing
    assert get_namespaced_alert_id("v2-eval-001", "v2") == "v2-eval-001"
    assert get_namespaced_alert_id("v2-eval-003", "v2") == "v2-eval-003"

    # Robustness against case and whitespace
    assert get_namespaced_alert_id("eval-001", " V2 ") == "v2-eval-001"
    assert get_namespaced_alert_id("eval-001", None) == "eval-001"
    assert get_namespaced_alert_id("eval-001", "unknown") == "eval-001"


def test_no_cross_dataset_alert_id_collision():
    """Verify zero overlap between resolved alert IDs in Dataset v1 and Dataset v2."""
    assert DATASET_V1_PATH.exists(), f"Missing {DATASET_V1_PATH}"
    assert DATASET_V2_PATH.exists(), f"Missing {DATASET_V2_PATH}"

    with DATASET_V1_PATH.open("r", encoding="utf-8") as f:
        v1_data = json.load(f)
    with DATASET_V2_PATH.open("r", encoding="utf-8") as f:
        v2_data = json.load(f)

    v1_version = v1_data.get("dataset_version", "v1")
    v2_version = v2_data.get("dataset_version", "v2")

    v1_ids = {
        get_namespaced_alert_id(c["alert"]["id"], v1_version)
        for c in v1_data["cases"]
    }
    v2_ids = {
        get_namespaced_alert_id(c["alert"]["id"], v2_version)
        for c in v2_data["cases"]
    }

    assert len(v1_ids) == 8, f"Expected 8 cases in v1, got {len(v1_ids)}"
    assert len(v2_ids) == 40, f"Expected 40 cases in v2, got {len(v2_ids)}"

    collision = v1_ids & v2_ids
    assert not collision, f"Detected alert ID collision between v1 and v2: {collision}"


# ---------------------------------------------------------------------------
# 2. Dataset v2 Content & Ground-Truth Alignment
# ---------------------------------------------------------------------------

def test_dataset_v2_ground_truth_alignment():
    """Verify that Dataset v2 cases 3-8 carry their own scenario definitions, not v1's."""
    with DATASET_V2_PATH.open("r", encoding="utf-8") as f:
        cases = json.load(f)["cases"]

    case_map = {c["case_id"]: c for c in cases}

    # Case 3 must be Kerberoasting, NOT Web Shell
    c3 = case_map["case-03-kerberoasting"]
    assert "Kerberos" in c3["alert"]["rule"]["description"]
    assert "RC4" in c3["alert"]["rule"]["description"]
    assert "T1558.003" in c3["ground_truth"]["expected_techniques"]
    assert "T1505.003" not in c3["ground_truth"]["expected_techniques"]

    # Case 4 must be MFA Fatigue, NOT Scheduled Task
    c4 = case_map["case-04-mfa-fatigue-bombing"]
    assert "MFA" in c4["alert"]["rule"]["description"]
    assert "T1621" in c4["ground_truth"]["expected_techniques"]
    assert "T1053.005" not in c4["ground_truth"]["expected_techniques"]

    # Case 5 must be Encoded PowerShell, NOT Sudoers
    c5 = case_map["case-05-encoded-powershell"]
    assert "PowerShell" in c5["alert"]["rule"]["description"]
    assert "T1059.001" in c5["ground_truth"]["expected_techniques"]
    assert "T1548.003" not in c5["ground_truth"]["expected_techniques"]

    # Case 7 must be WScript Launch, NOT Port Scan
    c7 = case_map["case-07-suspicious-wscript-launch"]
    assert "WScript" in c7["alert"]["rule"]["description"]
    assert "T1059.005" in c7["ground_truth"]["expected_techniques"]
    assert "T1046" not in c7["ground_truth"]["expected_techniques"]

    # Case 8 must be Bash Reverse Shell, NOT Shadow Copy Deletion
    c8 = case_map["case-08-bash-reverse-shell"]
    assert "bash" in c8["alert"]["rule"]["description"].lower()
    assert "T1059.004" in c8["ground_truth"]["expected_techniques"]
    assert "T1490" not in c8["ground_truth"]["expected_techniques"]


def test_dataset_schemas_valid():
    """Verify that both evaluation datasets adhere to their schema contracts."""
    # Dataset v2 must pass full strict schema validation (including is_benign negative controls)
    with DATASET_V2_PATH.open("r", encoding="utf-8") as f:
        v2 = json.load(f)
    errors_v2 = validate_dataset_schema(v2)
    assert not errors_v2, f"Dataset v2 schema errors: {errors_v2}"

    # Dataset v1 has baseline schema contract (authored prior to negative controls)
    with DATASET_V1_PATH.open("r", encoding="utf-8") as f:
        v1 = json.load(f)
    assert v1.get("dataset_version") == "v1"
    cases_v1 = v1.get("cases", [])
    assert len(cases_v1) == 8, f"Expected 8 cases in v1, got {len(cases_v1)}"

    seen_ids = set()
    for idx, c in enumerate(cases_v1):
        assert "case_id" in c, f"v1 Case {idx} missing 'case_id'"
        assert "alert" in c and "id" in c["alert"], f"v1 Case {idx} missing alert id"
        assert c["alert"]["id"] not in seen_ids, f"Duplicate alert id in v1: {c['alert']['id']}"
        seen_ids.add(c["alert"]["id"])
        assert "rule" in c["alert"] and "description" in c["alert"]["rule"], f"v1 Case {idx} missing rule"
        assert "ground_truth" in c, f"v1 Case {idx} missing ground_truth"
        assert c["ground_truth"]["expected_severity_band"] in {"low", "medium", "high", "critical"}
        assert isinstance(c["ground_truth"]["expected_techniques"], list)


# ---------------------------------------------------------------------------
# 3. Seeding Logic & Idempotency
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_seed_alert_enrichment_and_new_insert():
    """Verify that seed_alert creates a namespaced alert and enriches provenance."""
    sample_case = {
        "case_id": "case-03-kerberoasting",
        "category": "credential_access",
        "notes": "Kerberoasting TGS request scenario",
        "alert": {
            "id": "eval-003",
            "timestamp": "2026-05-20T10:00:00.000+0000",
            "rule": {
                "id": "4769",
                "level": 10,
                "description": "Active Directory: Abnormal volume of Kerberos TGS ticket requests",
                "groups": ["windows", "active_directory"],
                "mitre": {"id": ["T1558.003"], "tactic": ["Credential Access"]},
            },
            "agent": {"name": "dc-primary"},
            "data": {"srcip": "10.0.1.55", "user": "svc_sql"},
        },
    }

    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_result = MagicMock()
    # Simulate: alert does not exist yet in DB
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    # Simulate DB generating auto-increment ID on refresh
    def fake_refresh(instance):
        instance.id = 101

    mock_db.refresh.side_effect = fake_refresh

    with patch("scripts.run_evaluation.AsyncSessionLocal") as mock_session_cls:
        mock_session_cls.return_value.__aenter__.return_value = mock_db

        alert_id = await seed_alert(sample_case, dataset_version="v2")

        assert alert_id == 101

        # Verify add was called
        assert mock_db.add.called
        added_alert = mock_db.add.call_args[0][0]

        # Verify namespacing
        assert added_alert.external_alert_id == "v2-eval-003"
        assert added_alert.rule_description == "Active Directory: Abnormal volume of Kerberos TGS ticket requests"
        assert added_alert.data_source == "demo"

        # Verify raw data carries provenance
        raw = json.loads(added_alert.raw_data)
        assert raw["dataset_version"] == "v2"
        assert raw["scenario_id"] == "case-03-kerberoasting"
        assert raw["scenario_title"] == "Kerberoasting TGS request scenario"
        assert raw["attack_category"] == "credential_access"


@pytest.mark.asyncio
async def test_seed_alert_synchronizes_drifted_existing_record():
    """Verify that if an alert row exists with drifted content, it is synchronized."""
    sample_case = {
        "case_id": "case-03-kerberoasting",
        "alert": {
            "id": "v2-eval-003",
            "timestamp": "2026-05-20T10:00:00.000+0000",
            "rule": {
                "id": "4769",
                "level": 10,
                "description": "Active Directory: Kerberos TGS ticket requests updated",
            },
        },
    }

    existing_row = MagicMock()
    existing_row.id = 99
    existing_row.rule_id = "4769"
    existing_row.rule_description = "Outdated rule description"
    existing_row.severity = 10
    existing_row.agent_name = None
    existing_row.source_ip = None
    existing_row.destination_ip = None
    existing_row.username = None
    existing_row.raw_data = "{}"

    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = existing_row
    mock_db.execute.return_value = mock_result

    with patch("scripts.run_evaluation.AsyncSessionLocal") as mock_session_cls:
        mock_session_cls.return_value.__aenter__.return_value = mock_db

        returned_id = await seed_alert(sample_case, dataset_version="v2")

        assert returned_id == 99
        # Verify rule description was updated to match current scenario
        assert existing_row.rule_description == "Active Directory: Kerberos TGS ticket requests updated"
        assert mock_db.commit.called
