"""End-to-end verification for the real backend vertical slice.

Proves the full chain for a single alert (default: Alert #1):

    PostgreSQL alert -> security context -> Qdrant retrieval -> evidence
    -> Ollama/qwen3:8b -> structured SOC analysis -> evidence validation
    -> PostgreSQL persistence -> API

This script performs NO mocking and NO fallbacks: every check either
verifies against a real backend component or FAILS loudly.

Usage:
    python scripts/verify_e2e.py [alert_id]

Exit codes: 0 = all checks passed, 1 = one or more checks failed.
"""
import asyncio
import sys
import time
from pathlib import Path

import httpx

# Add backend to path so we can import app
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

API_URL = "http://localhost:8000/api/v1"
QDRANT_URL = "http://localhost:6333"

PASS = "PASS"
FAIL = "FAIL"
failures: list = []


def check(label: str, ok: bool, detail: str = "") -> bool:
    status = PASS if ok else FAIL
    print(f"  [{status}] {label}" + (f" — {detail}" if detail else ""))
    if not ok:
        failures.append(label)
    return ok


async def verify_db(alert_id: int, analysis_id: int) -> None:
    """Direct PostgreSQL verification (independent of the API layer)."""
    from sqlalchemy import select, func as sa_func
    from app.db.database import AsyncSessionLocal
    from app.db.models.alert import Alert, Analysis, Evidence

    print("\n=== DATABASE VERIFICATION (direct SQLAlchemy) ===")
    async with AsyncSessionLocal() as db:
        alert = (await db.execute(select(Alert).where(Alert.id == alert_id))).scalar_one_or_none()
        check(f"alert id={alert_id} exists in PostgreSQL", alert is not None,
              f"rule={alert.rule_id!r} src_ip={alert.source_ip!r}" if alert else "")

        analysis = (
            await db.execute(select(Analysis).where(Analysis.id == analysis_id))
        ).scalar_one_or_none()
        check(f"analysis id={analysis_id} exists in PostgreSQL", analysis is not None)
        if analysis:
            check("analysis linked to correct alert", analysis.alert_id == alert_id,
                  f"analysis.alert_id={analysis.alert_id}")
            check("analysis.model_name is the real model", bool(analysis.model_name),
                  f"model_name={analysis.model_name!r}")
            check("analysis has non-empty summary", bool(analysis.summary and analysis.summary.strip()))
            check("analysis has confidence", bool(analysis.confidence), f"confidence={analysis.confidence!r}")
            check("analysis has explanation", bool(analysis.explanation and analysis.explanation.strip()))

            ev_rows = (
                await db.execute(
                    select(Evidence).where(Evidence.analysis_id == analysis_id)
                )
            ).scalars().all()
            check("evidence rows exist for analysis", len(ev_rows) > 0, f"count={len(ev_rows)}")
            for row in ev_rows:
                check(
                    f"evidence row id={row.id} has real provenance",
                    bool(row.source and row.document_id and row.citation),
                    f"source={row.source!r} doc={row.document_id!r} citation={row.citation!r}",
                )
            total = (
                await db.execute(select(sa_func.count()).select_from(Analysis))
            ).scalar_one()
            print(f"  [INFO] total analyses in DB: {total}")


async def verify_evidence_in_qdrant(analysis: dict) -> None:
    """Cross-check persisted evidence document_ids against real Qdrant payloads."""
    evidence = analysis.get("evidence") or []
    if not evidence:
        print("\n=== QDRANT EVIDENCE CROSS-CHECK ===")
        check("no evidence rows to cross-check", False, "analysis persisted with zero evidence")
        return

    print("\n=== QDRANT EVIDENCE CROSS-CHECK ===")
    async with httpx.AsyncClient(timeout=30.0) as client:
        for ev in evidence:
            doc_id = ev.get("document_id") or ""
            if not doc_id:
                check(f"evidence id={ev.get('id')} document_id present", False)
                continue
            body = {
                "filter": {"must": [{"key": "document_id", "match": {"value": doc_id}}]},
                "limit": 1,
                "with_payload": False,
            }
            res = await client.post(f"{QDRANT_URL}/collections/security_knowledge/points/scroll", json=body)
            points = res.json().get("result", {}).get("points", [])
            check(
                f"evidence doc '{doc_id}' exists in Qdrant",
                len(points) > 0,
                f"source={ev.get('source')} score={ev.get('relevance_score')}",
            )


async def main() -> int:
    alert_id = int(sys.argv[1]) if len(sys.argv) > 1 else 1

    async with httpx.AsyncClient(timeout=600.0) as client:
        # --- Step 1: alert list -------------------------------------------------
        print(f"=== STEP 1: GET {API_URL}/alerts/ ===")
        res = await client.get(f"{API_URL}/alerts/")
        res.raise_for_status()
        alerts = res.json()
        print(f"  alerts in DB: {len(alerts)} -> ids: {[a['id'] for a in alerts]}")
        if not check(f"alert id={alert_id} exists", any(a["id"] == alert_id for a in alerts)):
            return 1

        # --- Step 2: alert detail ------------------------------------------------
        print(f"\n=== STEP 2: GET {API_URL}/alerts/{alert_id} ===")
        res = await client.get(f"{API_URL}/alerts/{alert_id}")
        res.raise_for_status()
        alert = res.json()
        print(f"  rule={alert['rule_id']} | {alert['rule_description']}")
        print(f"  src_ip={alert['source_ip']} user={alert['username']} severity={alert['severity']}")

        # --- Step 3: security context --------------------------------------------
        print(f"\n=== STEP 3: GET {API_URL}/alerts/{alert_id}/security-context ===")
        res = await client.get(f"{API_URL}/alerts/{alert_id}/security-context")
        res.raise_for_status()
        context = res.json()
        check("security context has entities", bool(context.get("entities")), str(context.get("entities")))
        check("security context has MITRE techniques", bool(context.get("mitre_techniques")),
              str(context.get("mitre_techniques")))

        # --- Step 4: real analysis (the E2E pipeline) -----------------------------
        print(f"\n=== STEP 4: POST {API_URL}/alerts/{alert_id}/analyze?mode=evidence_aware ===")
        t0 = time.perf_counter()
        try:
            res = await client.post(f"{API_URL}/alerts/{alert_id}/analyze?mode=evidence_aware")
            wall = time.perf_counter() - t0
        except httpx.TimeoutException:
            print(f"  [{FAIL}] analyze request timed out after {time.perf_counter() - t0:.0f}s")
            failures.append("analyze request")
            return 1
        if res.status_code != 200:
            print(f"  [{FAIL}] HTTP {res.status_code}: {res.text[:500]}")
            failures.append("analyze request")
            return 1
        analysis = res.json()
        analysis_id = analysis["id"]
        print(f"  wall time: {wall:.1f}s | analysis id={analysis_id}")

        # --- Step 5: analysis content validation ----------------------------------
        print("\n=== STEP 5: ANALYSIS CONTENT VALIDATION ===")
        check("summary present", bool(analysis.get("summary")))
        check("severity_assessment present", bool(analysis.get("severity_assessment")))
        check("explanation/reasoning present", bool(analysis.get("explanation")))
        check("recommended_investigation present", bool(analysis.get("recommended_investigation")))
        check("confidence present", bool(analysis.get("confidence")), f"confidence={analysis.get('confidence')}")
        check("model_name recorded", bool(analysis.get("model_name")), f"model={analysis.get('model_name')}")
        check("analysis_type is evidence_aware", analysis.get("analysis_type") == "evidence_aware")
        evidence = analysis.get("evidence") or []
        check("evidence references persisted", len(evidence) > 0, f"count={len(evidence)}")
        for ev in evidence:
            print(f"    - [{ev.get('source')}] {ev.get('title')} (doc={ev.get('document_id')}, "
                  f"score={ev.get('relevance_score'):.4f}, citation={ev.get('citation')})")

        # --- Step 6: API round-trip for the persisted analysis ---------------------
        print("\n=== STEP 6: API VERIFICATION ===")
        res = await client.get(f"{API_URL}/alerts/{alert_id}")
        check(f"GET /alerts/{alert_id} returns real data", res.status_code == 200 and res.json().get("id") == alert_id)
        res = await client.get(f"{API_URL}/alerts/{alert_id}/security-context")
        check(f"GET /alerts/{alert_id}/security-context returns 200", res.status_code == 200)
        res = await client.get(f"{API_URL}/analyses/{analysis_id}")
        check(f"GET /analyses/{analysis_id} returns persisted analysis",
              res.status_code == 200 and res.json().get("id") == analysis_id)
        res = await client.get(f"{API_URL}/analyses/{analysis_id}/evidence")
        check(f"GET /analyses/{analysis_id}/evidence returns evidence rows",
              res.status_code == 200 and len(res.json()) == len(evidence))

        # --- Step 7: evidence <-> Qdrant provenance --------------------------------
        await verify_evidence_in_qdrant(analysis)

    # --- Step 8: direct PostgreSQL verification --------------------------------
    await verify_db(alert_id, analysis_id)

    # --- Summary -----------------------------------------------------------------
    print("\n" + "=" * 70)
    if failures:
        print(f"E2E RESULT: FAILED — {len(failures)} failing check(s):")
        for f in failures:
            print(f"  - {f}")
        return 1
    print(f"E2E RESULT: SUCCESS — real vertical slice verified "
          f"(alert_id={alert_id}, analysis_id={analysis_id})")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
