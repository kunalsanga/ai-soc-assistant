import pytest
from app.security.normalization import normalize_wazuh_alert
from app.wazuh.schemas import NormalizedSecurityAlert


FULL_ALERT = {
    "id": "1676793480.123456",
    "timestamp": "2026-05-20T10:00:00.000+0000",
    "rule": {
        "id": "5710",
        "level": 10,
        "description": "sshd: Attempt to login using a non-existent user",
        "groups": ["authentication_failed", "syslog"],
        "mitre": {"id": ["T1110"], "tactic": ["Credential Access"]},
    },
    "agent": {"id": "001", "name": "linux-lab", "os": {"name": "Ubuntu", "version": "22.04"}},
    "data": {
        "srcip": "192.168.1.20",
        "srcport": 51234,
        "dstip": "192.168.1.5",
        "dstport": 22,
        "dstuser": "test-user",
    },
    "location": "/var/log/auth.log",
}


def test_normalize_full_alert():
    alert = normalize_wazuh_alert(FULL_ALERT)

    assert isinstance(alert, NormalizedSecurityAlert)
    assert alert.external_alert_id == "1676793480.123456"
    assert alert.severity == 10
    assert alert.rule_id == "5710"
    assert alert.rule_description.startswith("sshd:")
    assert alert.agent_name == "linux-lab"
    assert alert.agent_os == "Ubuntu"
    assert alert.source_ip == "192.168.1.20"
    assert alert.destination_ip == "192.168.1.5"
    assert alert.source_port == 51234
    assert alert.destination_port == 22
    assert alert.username == "test-user"
    assert alert.location == "/var/log/auth.log"
    assert alert.event_type == "authentication_failed"
    assert alert.mitre_techniques == ["T1110"]
    assert alert.mitre_tactics == ["credential access"]
    assert alert.timestamp == "2026-05-20T10:00:00.000+00:00"


def test_normalization_preserves_raw_payload():
    alert = normalize_wazuh_alert(FULL_ALERT)
    # Raw Wazuh data must be preserved verbatim for audit/debug.
    assert alert.raw_wazuh_data == FULL_ALERT
    assert alert.raw_event == FULL_ALERT


def test_normalize_sparse_alert_missing_fields():
    """Normalization must tolerate missing fields without raising."""
    sparse = {"id": "mock-003", "rule": {"id": "31151", "level": 5}}
    alert = normalize_wazuh_alert(sparse)

    assert alert.external_alert_id == "mock-003"
    assert alert.severity == 5
    assert alert.source_ip is None
    assert alert.destination_ip is None
    assert alert.username is None
    assert alert.mitre_techniques == []
    assert alert.mitre_tactics == []
    assert alert.agent_name is None


def test_normalize_empty_rule_defaults_severity():
    alert = normalize_wazuh_alert({"id": "x-1"})
    assert alert.severity == 0
    assert alert.rule_id is None


def test_normalize_clamps_out_of_range_severity():
    high = normalize_wazuh_alert({"id": "x-2", "rule": {"level": 99}})
    assert high.severity == 15

    low = normalize_wazuh_alert({"id": "x-3", "rule": {"level": -3}})
    assert low.severity == 0


def test_normalize_rejects_missing_id():
    with pytest.raises(ValueError):
        normalize_wazuh_alert({"rule": {"level": 5}})


def test_normalize_rejects_non_dict():
    with pytest.raises(ValueError):
        normalize_wazuh_alert("not-a-dict")


def test_normalize_handles_list_style_mitre():
    raw = {
        "id": "x-4",
        "rule": {
            "level": 7,
            "mitre": [
                {"id": "T1078", "tactic": "Defense Evasion"},
                {"id": "T1078", "tactic": "Defense Evasion"},  # duplicate
            ],
        },
    }
    alert = normalize_wazuh_alert(raw)
    assert alert.mitre_techniques == ["T1078"]
    assert alert.mitre_tactics == ["defense evasion"]


def test_normalization_is_deterministic():
    a = normalize_wazuh_alert(FULL_ALERT)
    b = normalize_wazuh_alert(FULL_ALERT)
    assert a.model_dump() == b.model_dump()
