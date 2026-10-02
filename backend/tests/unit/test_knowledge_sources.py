"""Phase 4A unit tests: source adapters (MITRE STIX + NVD API 2.0 formats).

Records below mirror the official published formats (verified against
mitre-attack/attack-stix-data docs and NVD developer docs). No network.
"""
import json
import pytest

from app.rag.knowledge.sources.base import KnowledgeSourceError
from app.rag.knowledge.sources.mitre import MitreAttackSource
from app.rag.knowledge.sources.nvd import NvdCveSource


# ---------------------------------------------------------------------------
# MITRE ATT&CK (STIX bundle format)
# ---------------------------------------------------------------------------

def _stix_technique(**overrides):
    record = {
        "type": "attack-pattern",
        "id": "attack-pattern--a1b2c3d4",
        "name": "Brute Force",
        "description": "Adversaries may use brute force techniques to gain access.",
        "external_references": [
            {
                "source_name": "mitre-attack",
                "external_id": "T1110",
                "url": "https://attack.mitre.org/techniques/T1110/",
            }
        ],
        "x_mitre_platforms": ["Linux", "Windows"],
        "kill_chain_phases": [
            {"kill_chain_name": "mitre-attack", "phase_name": "credential-access"}
        ],
        "x_mitre_is_subtechnique": False,
        "x_mitre_detection": "Monitor authentication logs for repeated failures.",
        "x_mitre_version": "1.3",
        "created": "2017-05-31T21:30:41.733Z",
        "modified": "2020-03-29T22:34:11.123Z",
    }
    record.update(overrides)
    return record


def _write_bundle(tmp_path, objects):
    bundle = {"type": "bundle", "id": "bundle--x", "objects": objects}
    path = tmp_path / "enterprise-attack.json"
    path.write_text(json.dumps(bundle), encoding="utf-8")
    return path


def test_mitre_normalization_full(tmp_path):
    source = MitreAttackSource(_write_bundle(tmp_path, [_stix_technique()]))
    docs, errors = source.load()

    assert errors == []
    assert len(docs) == 1
    doc = docs[0]
    assert doc.document_id == "mitre_attack:technique:T1110"
    assert doc.source_identifier == "T1110"
    assert doc.title == "Brute Force"
    assert doc.source_url == "https://attack.mitre.org/techniques/T1110/"
    assert doc.metadata["tactics"] == ["credential-access"]
    assert doc.metadata["platforms"] == ["Linux", "Windows"]
    assert doc.metadata["is_sub_technique"] is False
    assert doc.metadata["detection"] == "Monitor authentication logs for repeated failures."
    assert doc.version == "1.3"
    assert doc.created == "2017-05-31T21:30:41.733Z"
    assert doc.updated == "2020-03-29T22:34:11.123Z"
    assert doc.metadata["references"][0]["external_id" if False else "url"] == \
        "https://attack.mitre.org/techniques/T1110/"


def test_mitre_subtechnique_flag(tmp_path):
    sub = _stix_technique(
        name="Password Cracking",
        external_references=[
            {"source_name": "mitre-attack", "external_id": "T1110.002",
             "url": "https://attack.mitre.org/techniques/T1110/002/"}
        ],
        x_mitre_is_subtechnique=True,
    )
    docs, _ = MitreAttackSource(_write_bundle(tmp_path, [sub])).load()
    assert docs[0].metadata["is_sub_technique"] is True
    assert docs[0].document_id.endswith("T1110.002")


def test_mitre_missing_optional_fields(tmp_path):
    sparse = {"type": "attack-pattern", "id": "attack-pattern--z", "name": "Minimal",
              "external_references": [{"source_name": "mitre-attack", "external_id": "T9999"}]}
    docs, errors = MitreAttackSource(_write_bundle(tmp_path, [sparse])).load()
    assert errors == []
    doc = docs[0]
    # Content composed strictly from fields present in the record.
    assert "Minimal (ATT&CK technique T9999)" in doc.content
    assert doc.metadata["platforms"] == []
    assert doc.metadata["tactics"] == []
    assert doc.metadata["detection"] is None
    assert doc.source_url is None


def test_mitre_invalid_records_rejected_with_reasons(tmp_path):
    objects = [
        {"type": "attack-pattern", "name": "No technique id"},   # no external_id
        {"type": "malware", "name": "Wrong type"},               # filtered by load_raw
        _stix_technique(),                                        # valid
    ]
    source = MitreAttackSource(_write_bundle(tmp_path, objects))
    docs, errors = source.load()
    assert len(docs) == 1
    # Only the malformed attack-pattern is a *rejection*; non-technique STIX
    # objects (relationships, markings, malware, ...) are filtered by
    # load_raw, not treated as errors — a real bundle has thousands of them.
    assert len(errors) == 1
    assert "external_id" in errors[0]


def test_mitre_missing_bundle_raises_clear_error(tmp_path):
    source = MitreAttackSource(tmp_path / "does-not-exist.json")
    with pytest.raises(KnowledgeSourceError) as excinfo:
        source.load_raw()
    assert "enterprise-attack.json" in str(excinfo.value)


def test_mitre_bad_json_raises_clear_error(tmp_path):
    path = tmp_path / "enterprise-attack.json"
    path.write_text("{not json", encoding="utf-8")
    with pytest.raises(KnowledgeSourceError):
        MitreAttackSource(path).load_raw()


def test_mitre_non_bundle_json_raises(tmp_path):
    path = tmp_path / "enterprise-attack.json"
    path.write_text(json.dumps({"foo": "bar"}), encoding="utf-8")
    with pytest.raises(KnowledgeSourceError):
        MitreAttackSource(path).load_raw()


# ---------------------------------------------------------------------------
# NVD / CVE (API 2.0 format)
# ---------------------------------------------------------------------------

def _nvd_record(**overrides):
    cve = {
        "id": "CVE-2024-12345",
        "descriptions": [
            {"lang": "es", "value": "Versión española"},
            {"lang": "en", "value": "A buffer overflow in Example Product allows RCE."},
        ],
        "metrics": {
            "cvssMetricV31": [
                {
                    "type": "Secondary",
                    "cvssData": {"baseScore": 7.5, "baseSeverity": "HIGH",
                                 "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N"},
                },
                {
                    "type": "Primary",
                    "cvssData": {"baseScore": 9.8, "baseSeverity": "CRITICAL",
                                 "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H"},
                },
            ]
        },
        "references": [{"url": "https://example.com/advisory", "source": "vendor"}],
        "published": "2024-01-15T10:00:00.000",
        "lastModified": "2024-02-20T12:00:00.000",
        "vulnStatus": "Modified",
        "containers": {
            "cna": {"affected": [{"vendor": "ExampleCorp", "product": "Example Product"}]}
        },
    }
    cve.update(overrides)
    return {"cve": cve}


def _write_nvd(tmp_path, vulnerabilities):
    path = tmp_path / "nvd_cves.json"
    path.write_text(json.dumps({"vulnerabilities": vulnerabilities}), encoding="utf-8")
    return path


def test_nvd_normalization_full(tmp_path):
    docs, errors = NvdCveSource(_write_nvd(tmp_path, [_nvd_record()])).load()
    assert errors == []
    doc = docs[0]
    assert doc.document_id == "nvd_cve:cve_record:CVE-2024-12345"
    assert doc.source_identifier == "CVE-2024-12345"
    # Primary metric preferred over Secondary.
    assert doc.metadata["cvss_base_score"] == 9.8
    assert doc.metadata["cvss_severity"] == "CRITICAL"
    assert doc.metadata["affected_products"][0]["vendor"] == "ExampleCorp"
    assert doc.source_url == "https://nvd.nist.gov/vuln/detail/CVE-2024-12345"
    assert doc.created == "2024-01-15T10:00:00.000"
    assert doc.updated == "2024-02-20T12:00:00.000"
    # English description preferred over other languages.
    assert "buffer overflow" in doc.content


def test_nvd_missing_optional_fields(tmp_path):
    sparse = {"cve": {"id": "CVE-2024-00001"}}
    docs, errors = NvdCveSource(_write_nvd(tmp_path, [sparse])).load()
    assert errors == []
    doc = docs[0]
    # Content composed strictly from fields present in the record.
    assert doc.content.startswith("CVE-2024-00001 vulnerability record.")
    assert doc.metadata["cvss_base_score"] is None
    assert doc.metadata["cvss_severity"] is None
    assert doc.metadata["cvss_vector"] is None
    assert doc.metadata["affected_products"] == []
    assert doc.metadata["references"] == []
    assert "Unknown severity" in doc.title


def test_nvd_invalid_records_rejected(tmp_path):
    vulnerabilities = [
        {"cve": {"descriptions": [{"lang": "en", "value": "no id"}]}},  # missing id
        {"cve": {"id": "NOT-A-CVE", "descriptions": []}},                # bad format
        _nvd_record(),                                                    # valid
    ]
    docs, errors = NvdCveSource(_write_nvd(tmp_path, vulnerabilities)).load()
    assert len(docs) == 1
    assert len(errors) == 2


def test_nvd_accepts_bare_record_list(tmp_path):
    path = tmp_path / "nvd_cves.json"
    path.write_text(json.dumps([_nvd_record()]), encoding="utf-8")
    docs, _ = NvdCveSource(path).load()
    assert len(docs) == 1


def test_nvd_missing_file_raises_clear_error(tmp_path):
    with pytest.raises(KnowledgeSourceError) as excinfo:
        NvdCveSource(tmp_path / "missing.json").load_raw()
    assert "NVD" in str(excinfo.value)


# ---------------------------------------------------------------------------
# Cross-source determinism
# ---------------------------------------------------------------------------

def test_mitre_normalization_is_deterministic(tmp_path):
    source = MitreAttackSource(_write_bundle(tmp_path, [_stix_technique()]))
    docs_a, _ = source.load()
    docs_b, _ = source.load()
    assert [d.model_dump() for d in docs_a] == [d.model_dump() for d in docs_b]


def test_nvd_normalization_is_deterministic(tmp_path):
    source = NvdCveSource(_write_nvd(tmp_path, [_nvd_record()]))
    docs_a, _ = source.load()
    docs_b, _ = source.load()
    assert [d.model_dump() for d in docs_a] == [d.model_dump() for d in docs_b]
