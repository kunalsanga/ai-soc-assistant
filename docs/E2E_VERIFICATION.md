# End-to-End Verification Report

**Verification Date**: 2026-10-17  
**Host Environment**: Windows 11 + Docker Compose  
**Stack**: PostgreSQL 15, Qdrant v1.18.2, Ollama `qwen3:8b`, FastAPI, Vite React  

---

## 1. Verified Slice Overview

The end-to-end pipeline was executed live without fallbacks or synthetic mock data.

```
PostgreSQL Alert (id=1, "mock-001")
    ↓
Security Context Extraction (IP 192.168.1.20, user "test-user", rule 5710, T1110)
    ↓
Dense Semantic Retrieval via sentence-transformers/all-MiniLM-L6-v2 (384-dim)
    ↓
Qdrant Knowledge Match (Collection: security_knowledge, 1,762 indexed chunks)
    → Matched: mitre_attack:technique:T1110 ("Brute Force", score 0.2833)
    ↓
Ollama Local LLM Inference (qwen3:8b via HTTP API)
    ↓
Evidence-Reference Validation (citations checked against retrieved chunks)
    ↓
PostgreSQL Persistence (Analysis ID=1, Evidence ID=1)
    ↓
FastAPI Response & React UI Rendering
```

---

## 2. Verified Data Records

### Persisted Alert
- **Alert ID**: `1`
- **External Alert ID**: `mock-001`
- **Rule ID**: `5710`
- **Description**: `sshd: Attempt to login using a non-existent user`
- **Source IP**: `192.168.1.20`
- **User**: `test-user`
- **Severity**: `10` (High)

### Persisted Analysis
- **Analysis ID**: `1`
- **Alert ID**: `1`
- **Analysis Type**: `evidence_aware`
- **Model Name**: `qwen3:8b`
- **Severity Assessment**: `The severity is high due to the potential for credential access, which could lead to unauthorized access to systems or data.`
- **Summary**: `A failed authentication attempt was detected using a non-existent user 'test-user' from IP 192.168.1.20. This aligns with the MITRE technique T1110, which is associated with credential access.`
- **Confidence**: `MEDIUM`
- **Investigation Steps**:
  1. Check logs for additional failed login attempts
  2. Verify if the user 'test-user' exists on the system
  3. Review network traffic from the IP 192.168.1.20 for suspicious activity
- **Explicit Limitations**:
  `The alert does not provide enough information to confirm whether the attempt was successful or if it was part of a larger attack.`

### Linked Evidence
- **Evidence ID**: `1`
- **Analysis ID**: `1`
- **Source**: `mitre_attack`
- **Document ID**: `mitre_attack:technique:T1110`
- **Title**: `Brute Force`
- **Relevance Score**: `0.2833`
- **Citation**: `T1110 - Brute Force`
- **Status**: Genuine retrieved record confirmed in Qdrant collection.

---

## 3. Component Status During Verification

| Component | Endpoint / Address | Status | Notes |
|---|---|---|---|
| PostgreSQL | `db:5432` / host: `5433` | Connected & Healthy | Schema head applied, 11 alerts, 1 analysis, 1 evidence record. |
| Qdrant | `qdrant:6333` | Connected & Healthy | 1,762 indexed vectors in `security_knowledge`. |
| Ollama | `host.docker.internal:11434` | Connected & Reachable | `qwen3:8b` model loaded and verified. |
| FastAPI | `http://localhost:8000` | Operational | Interactive docs at `/docs`, health at `/api/v1/health`. |
| React UI | `http://localhost:5173` | Operational | Dark cyber theme with live metrics and real API integration. |
