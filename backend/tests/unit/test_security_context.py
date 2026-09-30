"""Unit tests for the Phase 3 security context pipeline (spec Step 5).

Covers: preprocessor cleaning, context extraction, retrieval query
generation, determinism, missing-field tolerance, and the no-hallucination
rule. All pure; no DB, no network.
"""
import pytest

from app.security.context import ContextExtractor
from app.security.pipeline import SecurityContextPipeline
from app.security.preprocessing import preprocess_alert
from app.security.retrieval_queries import RetrievalQueryBuilder
from app.security.schemas import PreprocessedAlert, RetrievalQuerySet, SecurityContext
from app.wazuh.schemas import NormalizedSecurityAlert


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

def _rich_alert() -> NormalizedSecurityAlert:
    return NormalizedSecurityAlert(
        external_alert_id="1676793480.123456",
        timestamp="2026-05-20T10:00:00.000+00:00",
        severity=10,
        event_type="authentication_failure",
        rule_id="5710",
        rule_description="sshd: Attempt to login using a non-existent user",
        agent_id="001",
        agent_name="linux-lab",
        agent_os="Ubuntu",
        source_ip="192.168.1.20",
        destination_ip="192.168.1.5",
        source_port=51234,
        destination_port=22,
        username="test-user",
        process="sshd",
        file_path="/var/log/auth.log",
        location="/var/log/auth.log",
        mitre_tactics=["Credential Access"],
        mitre_techniques=["T1110"],
    )


def _minimal_alert() -> NormalizedSecurityAlert:
    return NormalizedSecurityAlert(external_alert_id="min-001")


# ---------------------------------------------------------------------------
# 1-3. Rich, sparse, malformed
# ---------------------------------------------------------------------------

def test_preprocess_rich_alert():
    result = preprocess_alert(_rich_alert())
    assert result.alert_id == "1676793480.123456"
    assert result.source_ip == "192.168.1.20"
    assert result.destination_ip == "192.168.1.5"
    assert result.username == "test-user"
    assert result.mitre_techniques == ["T1110"]
    assert result.mitre_tactics == ["credential access"]
    assert result.dropped_fields == []


def test_preprocess_minimal_alert_missing_fields():
    result = preprocess_alert(_minimal_alert())
    assert result.alert_id == "min-001"
    assert result.source_ip is None
    assert result.username is None
    assert result.mitre_techniques == []
    # Every optional field that was absent is tracked, not silently lost.
    assert "source_ip" in result.dropped_fields
    assert "username" in result.dropped_fields


def test_preprocess_malformed_nested_structures():
    alert = NormalizedSecurityAlert(
        external_alert_id="bad-001",
        source_ip="999.1.1.1",           # invalid octet
        destination_ip="not-an-ip",      # garbage
        source_port=99999,               # out of range
        username="   ",                  # whitespace only
        event_type="none",               # noisy placeholder
    )
    result = preprocess_alert(alert)
    assert result.source_ip is None
    assert result.destination_ip is None
    assert result.source_port is None
    assert result.username is None
    assert result.event_type is None
    assert "source_ip(malformed)" in result.dropped_fields
    assert "destination_ip(malformed)" in result.dropped_fields


# ---------------------------------------------------------------------------
# 4-7. MITRE, network indicators, process, authentication
# ---------------------------------------------------------------------------

def test_preprocess_canonicalizes_mitre_ids():
    alert = NormalizedSecurityAlert(
        external_alert_id="mitre-001",
        mitre_techniques=["t1110.001", "T1110.001", "T1110 (Brute Force)"],
        mitre_tactics=["TA0006", "credential access"],
    )
    result = preprocess_alert(alert)
    assert result.mitre_techniques == ["T1110.001"]
    assert result.mitre_tactics == ["TA0006", "credential access"]


def test_context_extraction_network_indicators():
    context = ContextExtractor().extract(preprocess_alert(_rich_alert()))
    assert context.entities["source_ip"] == ["192.168.1.20"]
    assert context.entities["destination_ip"] == ["192.168.1.5"]
    assert context.entities["destination_port"] == ["22"]
    assert context.event_type == "authentication_failure"


def test_context_extraction_process_information():
    alert = NormalizedSecurityAlert(
        external_alert_id="proc-001",
        rule_description="Suspicious binary execution",
        process="powershell.exe",
        file_path="C:\\\\Temp\\\\svchost.exe",
    )
    context = ContextExtractor().extract(preprocess_alert(alert))
    assert context.entities["process"] == ["powershell.exe"]
    assert context.entities["file_path"] == ["C:\\\\Temp\\\\svchost.exe"]


def test_context_extraction_authentication_event():
    context = ContextExtractor().extract(preprocess_alert(_rich_alert()))
    # Authentication keywords derived deterministically from the description.
    assert "authentication" in context.keywords or "login" in context.keywords
    assert context.rule_id == "5710"


def test_context_extractor_skips_absent_entities():
    context = ContextExtractor().extract(preprocess_alert(_minimal_alert()))
    # Nothing invented: only the alert id and defaults exist.
    assert context.entities == {}
    assert context.mitre_techniques == []
    assert context.keywords == []
    assert context.alert_id == "min-001"


# ---------------------------------------------------------------------------
# 8. Empty / noisy textual fields
# ---------------------------------------------------------------------------

def test_preprocess_noisy_text_fields():
    alert = NormalizedSecurityAlert(
        external_alert_id="noise-001",
        event_type="NULL",
        username="N/A",
        rule_description="unknown",
        process="-",
    )
    result = preprocess_alert(alert)
    assert result.event_type is None
    assert result.username is None
    assert result.rule_description is None
    assert result.process is None


# ---------------------------------------------------------------------------
# 9-10. Determinism and no hallucination
# ---------------------------------------------------------------------------

def test_pipeline_is_deterministic():
    pipeline = SecurityContextPipeline()
    a = pipeline.run(_rich_alert())
    b = pipeline.run(_rich_alert())
    assert a.model_dump() == b.model_dump()


def test_no_hallucinated_fields():
    """An alert with just an IP must not grow reputation/geo/etc. fields."""
    alert = NormalizedSecurityAlert(
        external_alert_id="ip-only-001",
        source_ip="10.0.0.5",
    )
    context = SecurityContextPipeline().extract_context(preprocess_alert(alert))

    assert set(context.entities.keys()) == {"source_ip"}
    assert context.entities["source_ip"] == ["10.0.0.5"]
    # Forbidden inference keys must never appear.
    for forbidden in ("country", "organization", "malicious", "reputation", "geo"):
        assert forbidden not in context.entities
    dump = context.model_dump()
    assert "malicious" not in dump and "country" not in dump


def test_mitre_queries_only_from_alert_techniques():
    """No MITRE query may be produced when the alert carries no techniques."""
    query_set = SecurityContextPipeline().run(_minimal_alert())
    assert query_set.mitre_queries == []


# ---------------------------------------------------------------------------
# 11-13. Retrieval query generation
# ---------------------------------------------------------------------------

def test_query_generation_categories():
    alert = NormalizedSecurityAlert(
        external_alert_id="q-001",
        event_type="authentication_failure",
        rule_description="Multiple authentication failures followed by success "
                         "referencing CVE-2024-12345",
        mitre_techniques=["T1110"],
    )
    query_set = SecurityContextPipeline().run(alert)

    assert isinstance(query_set, RetrievalQuerySet)
    assert len(query_set.mitre_queries) == 1
    assert query_set.mitre_queries[0].metadata == {"technique_id": "T1110"}
    assert query_set.mitre_queries[0].source_hint == "MITRE"

    # CVE came from the alert text only.
    assert len(query_set.nvd_queries) == 1
    assert query_set.nvd_queries[0].metadata["cve_id"] == "CVE-2024-12345"

    assert len(query_set.security_queries) >= 1
    assert query_set.security_queries[0].category == "security"


def test_query_ids_are_unique_and_stable():
    alert = NormalizedSecurityAlert(
        external_alert_id="q-002",
        event_type="web_scan",
        rule_description="Web scanner activity CVE-2023-99999",
        mitre_techniques=["T1595"],
    )
    query_set = SecurityContextPipeline().run(alert)
    ids = [q.query_id for q in query_set.all_queries()]
    assert len(ids) == len(set(ids))
    # Determinism: same alert → identical ids.
    again = SecurityContextPipeline().run(alert)
    assert [q.query_id for q in again.all_queries()] == ids


def test_query_generation_minimal_alert():
    """Minimal alert → empty query set. The builder must NOT fabricate a
    generic query from nothing (no-hallucination rule, spec Step 4)."""
    query_set = SecurityContextPipeline().run(_minimal_alert())
    assert query_set.alert_id == "min-001"
    assert query_set.mitre_queries == []
    assert query_set.nvd_queries == []
    assert query_set.security_queries == []
    assert query_set.all_queries() == []


def test_preprocess_preserves_original_alert():
    """The preprocessor must never mutate the input alert."""
    alert = _rich_alert()
    before = alert.model_dump()
    preprocess_alert(alert)
    assert alert.model_dump() == before


def test_context_extractor_accepts_preprocessed_model_directly():
    pa = PreprocessedAlert(alert_id="direct-001", event_type="x")
    context = ContextExtractor().extract(pa)
    assert isinstance(context, SecurityContext)
    assert context.alert_id == "direct-001"


def test_query_builder_accepts_context_model_directly():
    ctx = SecurityContext(alert_id="direct-002", mitre_techniques=["T1078"])
    qs = RetrievalQueryBuilder().build(ctx)
    assert isinstance(qs, RetrievalQuerySet)
    assert qs.mitre_queries[0].text == "MITRE ATT&CK technique T1078"
