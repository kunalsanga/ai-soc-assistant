import json
import numpy as np
from pathlib import Path
from collections import defaultdict

def audit():
    results_path = Path("backend/evaluation/results/20261109-185423-0f4cfd/results.json")
    ablation_path = Path("backend/evaluation/results/20261109-185423-0f4cfd/ablation.json")

    with open(results_path, "r", encoding="utf-8") as f:
        res = json.load(f)

    with open(ablation_path, "r", encoding="utf-8") as f:
        abl = json.load(f)

    records = res.get("records", [])

    # 1. Basic Counts
    modes = sorted(list(set(r["mode"] for r in records)))
    cases = sorted(list(set(r["case_id"] for r in records)))
    categories = sorted(list(set(r["category"] for r in records)))
    benign_cases = sorted(list(set(r["case_id"] for r in records if r.get("is_benign"))))
    attack_cases = sorted(list(set(c for c in cases if c not in benign_cases)))

    print("=== RECORD INTEGRITY COUNTS ===")
    print(f"Total records in results.json: {len(records)}")
    print(f"Modes ({len(modes)}): {modes}")
    print(f"Total distinct cases ({len(cases)}): {cases}")
    print(f"Attack cases ({len(attack_cases)}): {len(attack_cases)}")
    print(f"Benign cases ({len(benign_cases)}): {len(benign_cases)}")
    assert len(records) == 120, f"Expected 120, got {len(records)}"
    assert len(cases) == 40, f"Expected 40, got {len(cases)}"
    assert len(attack_cases) == 36, f"Expected 36, got {len(attack_cases)}"
    assert len(benign_cases) == 4, f"Expected 4, got {len(benign_cases)}"

    # 2. Recalculate Classification Metrics on 36 Attack Scenarios
    print("\n=== INDEPENDENT RECALCULATION: CLASSIFICATION (36 Attack Scenarios) ===")
    for m in ["llm_only", "standard_rag", "evidence_aware"]:
        m_recs = [r for r in records if r["mode"] == m and not r.get("is_benign")]
        assert len(m_recs) == 36
        
        precisions = []
        recalls = []
        f1s = []
        total_tp = 0
        total_fp = 0
        total_fn = 0
        
        for r in m_recs:
            prf1 = r.get("technique_prf1", {})
            p = prf1.get("precision", 0.0)
            rec = prf1.get("recall", 0.0)
            f = prf1.get("f1", 0.0)
            tp = prf1.get("tp", 0)
            fp = prf1.get("fp", 0)
            fn = prf1.get("fn", 0)
            
            precisions.append(p)
            recalls.append(rec)
            f1s.append(f)
            total_tp += tp
            total_fp += fp
            total_fn += fn
            
        macro_f1 = np.mean(f1s)
        macro_p = np.mean(precisions)
        macro_r = np.mean(recalls)
        
        # Micro F1 (pooled across all instances)
        micro_p = total_tp / (total_tp + total_fp) if (total_tp + total_fp) > 0 else 0.0
        micro_r = total_tp / (total_tp + total_fn) if (total_tp + total_fn) > 0 else 0.0
        micro_f1 = 2 * micro_p * micro_r / (micro_p + micro_r) if (micro_p + micro_r) > 0 else 0.0
        
        print(f"[{m}]")
        print(f"  Macro F1:        {macro_f1:.4f} (target: {'0.9028' if m=='llm_only' else '0.8750' if m=='standard_rag' else '0.8611'})")
        print(f"  Micro F1:        {micro_f1:.4f} (target: {'0.8889' if m=='llm_only' else '0.8776' if m=='standard_rag' else '0.8600'})")
        print(f"  Macro Precision: {macro_p:.4f} (target: {'0.9861' if m=='llm_only' else '0.9583' if m=='standard_rag' else '0.9398'})")
        print(f"  Macro Recall:    {macro_r:.4f} (target: {'0.8611' if m=='llm_only' else '0.8333' if m=='standard_rag' else '0.8333'})")
        print(f"  Confusion Counts: TP={total_tp}, FP={total_fp}, FN={total_fn}")

    # 3. Recalculate Retrieval Ablation Metrics
    print("\n=== INDEPENDENT RECALCULATION: RETRIEVAL ABLATION (40 Scenarios) ===")
    for method, data in abl.items():
        cases_dict = data.get("per_case", {})
        ranks = []
        latencies = []
        for cid, cdata in cases_dict.items():
            r = cdata.get("first_relevant_rank")
            lat = cdata.get("latency_ms")
            ranks.append(r)
            if lat is not None:
                latencies.append(lat)
                
        rec1 = np.mean([1.0 if (r is not None and r == 1) else 0.0 for r in ranks])
        rec5 = np.mean([1.0 if (r is not None and 1 <= r <= 5) else 0.0 for r in ranks])
        mrr = np.mean([1.0 / r if (r is not None and r > 0) else 0.0 for r in ranks])
        mean_lat = np.mean(latencies) if latencies else 0.0
        std_lat = np.std(latencies) if latencies else 0.0
        
        print(f"[{method}] (N={len(ranks)})")
        print(f"  Recall@1: {rec1:.4f} ({sum(1 for r in ranks if r == 1)}/40)")
        print(f"  Recall@5: {rec5:.4f} ({sum(1 for r in ranks if r is not None and r <= 5)}/40)")
        print(f"  MRR:      {mrr:.4f}")
        print(f"  Latency:  Mean={mean_lat:.2f} ms, Std={std_lat:.2f} ms, Median={np.median(latencies):.2f} ms, Min={min(latencies):.2f} ms, Max={max(latencies):.2f} ms")

    # 4. Latency Statistics across End-to-End Modes
    print("\n=== INDEPENDENT RECALCULATION: END-TO-END LATENCY (Seconds) ===")
    for m in ["llm_only", "standard_rag", "evidence_aware"]:
        recs = [r for r in records if r["mode"] == m]
        wall_lats = [r["wall_latency_seconds"] for r in recs if r.get("wall_latency_seconds") is not None]
        llm_lats = [r["llm_latency_seconds"] for r in recs if r.get("llm_latency_seconds") is not None]
        print(f"[{m}] (N={len(wall_lats)})")
        print(f"  Wall Latency: Mean={np.mean(wall_lats):.2f}s, Std={np.std(wall_lats):.2f}s, Median={np.median(wall_lats):.2f}s, Min={min(wall_lats):.2f}s, Max={max(wall_lats):.2f}s")
        print(f"  LLM Latency:  Mean={np.mean(llm_lats):.2f}s, Std={np.std(llm_lats):.2f}s, Median={np.median(llm_lats):.2f}s, Min={min(llm_lats):.2f}s, Max={max(llm_lats):.2f}s")

    # 5. Benign Controls Accuracy
    print("\n=== INDEPENDENT RECALCULATION: BENIGN NEGATIVE CONTROLS ===")
    for m in ["llm_only", "standard_rag", "evidence_aware"]:
        recs = [r for r in records if r["mode"] == m and r.get("is_benign")]
        correct = [1.0 if (r.get("benign_eval") or {}).get("correctly_benign") else 0.0 for r in recs]
        print(f"[{m}] Benign Accuracy: {np.mean(correct):.4f} ({sum(correct)}/{len(correct)})")
        for r in recs:
            be = r.get("benign_eval") or {}
            print(f"   {r['case_id']}: correctly_benign={be.get('correctly_benign')}, confidence={r.get('confidence')}, expected_sev={r.get('expected_severity_band')}")

    # 6. CVE Evaluation
    print("\n=== INDEPENDENT RECALCULATION: CVE GROUNDING ===")
    for m in ["llm_only", "standard_rag", "evidence_aware"]:
        recs = [r for r in records if r["mode"] == m]
        cve_recs = [r for r in recs if r.get("expected_cves")]
        non_cve_recs = [r for r in recs if not r.get("expected_cves")]
        print(f"[{m}] Positive CVE cases count: {len(cve_recs)}, Negative CVE cases count: {len(non_cve_recs)}")
        for r in cve_recs:
            prf = r.get("cve_prf1", {})
            print(f"   {r['case_id']}: expected={r.get('expected_cves')}, predicted={r.get('predicted_cves')}, F1={prf.get('f1')}")
        false_cves = [r for r in non_cve_recs if r.get("predicted_cves")]
        print(f"   False positive CVE predictions on 39 non-CVE cases: {len(false_cves)}")

    # 7. Citation Reference ID Validity
    print("\n=== INDEPENDENT RECALCULATION: CITATION REFERENCE VALIDITY ===")
    for m in ["standard_rag", "evidence_aware"]:
        recs = [r for r in records if r["mode"] == m and not r.get("is_benign")]
        rates = [r["valid_evidence_reference_rate"] for r in recs if r.get("valid_evidence_reference_rate") is not None]
        print(f"[{m}] Valid reference rate mean: {np.mean(rates):.4f} across {len(rates)} scenarios")
        invalid = [r for r in recs if r.get("valid_evidence_reference_rate") is not None and r["valid_evidence_reference_rate"] < 1.0]
        for r in invalid:
            print(f"   Anomalous scenario: {r['case_id']}, rate={r['valid_evidence_reference_rate']}")

if __name__ == "__main__":
    audit()

