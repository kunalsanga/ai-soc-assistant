"""Generate publication-ready benchmark charts for PPD-II Third Review.

Reads:
- backend/evaluation/results/20261109-185423-0f4cfd/results.json
- backend/evaluation/results/20261109-185423-0f4cfd/ablation.json

Generates:
1. chart1_mitre_classification.png & .svg
2. chart2_retrieval_ablation.png & .svg
3. chart3_latency_analysis.png & .svg
4. chart4_scenario_performance_heatmap.png & .svg
5. chart5_technical_architecture.png & .svg

Output directory: docs/third_review/milestone_3/figures/
"""
from __future__ import annotations

import json
from pathlib import Path
import matplotlib.pyplot as plt
import numpy as np

# Styling configuration
plt.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["Segoe UI", "DejaVu Sans", "Helvetica", "Arial"],
    "font.size": 11,
    "axes.titlesize": 13,
    "axes.titleweight": "bold",
    "axes.labelsize": 11,
    "axes.labelweight": "semibold",
    "xtick.labelsize": 10,
    "ytick.labelsize": 10,
    "legend.fontsize": 10,
    "figure.titlesize": 15,
    "figure.titleweight": "bold",
    "axes.edgecolor": "#CCCCCC",
    "axes.linewidth": 1.0,
    "grid.color": "#E5E5E5",
    "grid.linestyle": "--",
    "grid.linewidth": 0.8,
})

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
RESULTS_DIR = PROJECT_ROOT / "backend" / "evaluation" / "results" / "20261109-185423-0f4cfd"
OUT_DIR = PROJECT_ROOT / "docs" / "third_review" / "milestone_3" / "figures"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Load data
with open(RESULTS_DIR / "results.json", "r", encoding="utf-8") as f:
    results_data = json.load(f)

with open(RESULTS_DIR / "ablation.json", "r", encoding="utf-8") as f:
    ablation_data = json.load(f)

records = results_data["records"]

# Color palette: Academic/Cybersecurity themed
COLOR_LLM = "#2B6CB0"       # Professional Steel Blue
COLOR_STD_RAG = "#DD6B20"   # Amber/Orange
COLOR_EVID_RAG = "#2F855A"  # Forest Green
COLOR_HASHING = "#6B46C1"   # Deep Purple


# ---------------------------------------------------------------------------
# Chart 1: MITRE ATT&CK Classification Comparison
# ---------------------------------------------------------------------------
def generate_chart1():
    metrics = ["Macro F1", "Micro F1", "Macro Precision", "Macro Recall"]
    
    # Exact audited figures (36 attack cases)
    llm_vals = [0.9028, 0.8889, 0.9861, 0.8611]
    std_vals = [0.8750, 0.8776, 0.9583, 0.8333]
    ea_vals  = [0.8611, 0.8600, 0.9398, 0.8333]

    x = np.arange(len(metrics))
    width = 0.25

    fig, ax = plt.subplots(figsize=(9, 5.5), dpi=300)
    
    rects1 = ax.bar(x - width, llm_vals, width, label="LLM-Only (Zero-Shot)", color=COLOR_LLM, edgecolor="#1A365D", alpha=0.92)
    rects2 = ax.bar(x, std_vals, width, label="Standard RAG (Dense Unanchored)", color=COLOR_STD_RAG, edgecolor="#7B341E", alpha=0.92)
    rects3 = ax.bar(x + width, ea_vals, width, label="Evidence-Aware RAG (Anchored)", color=COLOR_EVID_RAG, edgecolor="#1C4532", alpha=0.92)

    ax.set_ylabel("Score (0.0 – 1.0)")
    ax.set_title("MITRE ATT&CK Classification Performance Across Modes\n(Dataset v2: 36 Attack Scenarios, Qwen3:8B, Temp=0.0)", pad=15)
    ax.set_xticks(x)
    ax.set_xticklabels(metrics)
    ax.set_ylim(0.70, 1.05)
    ax.grid(axis="y", alpha=0.7)
    ax.legend(loc="lower right", framealpha=0.95)

    def autolabel(rects):
        for rect in rects:
            height = rect.get_height()
            ax.annotate(f"{height:.3f}",
                        xy=(rect.get_x() + rect.get_width() / 2, height),
                        xytext=(0, 4),
                        textcoords="offset points",
                        ha="center", va="bottom", fontsize=8.5, weight="bold")

    autolabel(rects1)
    autolabel(rects2)
    autolabel(rects3)

    plt.tight_layout()
    fig.savefig(OUT_DIR / "chart1_mitre_classification.png", dpi=300)
    fig.savefig(OUT_DIR / "chart1_mitre_classification.svg")
    plt.close(fig)
    print("Generated Chart 1: MITRE Classification")


# ---------------------------------------------------------------------------
# Chart 2: 40-Scenario Retrieval Ablation Study
# ---------------------------------------------------------------------------
def generate_chart2():
    metrics = ["Recall@1 (Top-1)", "Recall@5 (Top-5)", "Mean Reciprocal Rank (MRR)"]

    # Audited values from ablation.json
    std_vals = [0.2250, 0.4000, 0.2742]
    ea_vals  = [0.9000, 0.9250, 0.9125]
    hash_vals = [0.9250, 0.9250, 0.9250]

    x = np.arange(len(metrics))
    width = 0.24

    fig, ax = plt.subplots(figsize=(9.5, 5.5), dpi=300)

    rects1 = ax.bar(x - width, std_vals, width, label="Standard RAG (Dense Unanchored)", color=COLOR_STD_RAG, edgecolor="#7B341E", alpha=0.92)
    rects2 = ax.bar(x, ea_vals, width, label="Evidence-Aware (Entity-Anchored)", color=COLOR_EVID_RAG, edgecolor="#1C4532", alpha=0.92)
    rects3 = ax.bar(x + width, hash_vals, width, label="Token Hashing (Offline Baseline)", color=COLOR_HASHING, edgecolor="#44337A", alpha=0.92)

    ax.set_ylabel("Retrieval Accuracy Ratio")
    ax.set_title("Knowledge Retrieval Ablation: Impact of Entity Anchoring\n(40 Scenarios Headless Search Over 1,762 Security Chunks)", pad=15)
    ax.set_xticks(x)
    ax.set_xticklabels(metrics)
    ax.set_ylim(0.0, 1.15)
    ax.grid(axis="y", alpha=0.7)
    ax.legend(loc="upper left", framealpha=0.95)

    def autolabel(rects, is_highlight=False):
        for rect in rects:
            height = rect.get_height()
            color = "#1C4532" if is_highlight else "#333333"
            weight = "bold" if is_highlight else "normal"
            ax.annotate(f"{height*100:.1f}%",
                        xy=(rect.get_x() + rect.get_width() / 2, height),
                        xytext=(0, 4),
                        textcoords="offset points",
                        ha="center", va="bottom", fontsize=8.5, color=color, weight=weight)

    autolabel(rects1)
    autolabel(rects2, is_highlight=True)
    autolabel(rects3)

    # Highlight delta arrow
    ax.annotate("+67.5% Δ", xy=(0, 0.90), xytext=(-0.16, 0.55),
                arrowprops=dict(facecolor="#2F855A", shrink=0.08, width=2, headwidth=7),
                fontsize=11, fontweight="bold", color="#2F855A", ha="center")

    plt.tight_layout()
    fig.savefig(OUT_DIR / "chart2_retrieval_ablation.png", dpi=300)
    fig.savefig(OUT_DIR / "chart2_retrieval_ablation.svg")
    plt.close(fig)
    print("Generated Chart 2: Retrieval Ablation")


# ---------------------------------------------------------------------------
# Chart 3: Latency Analysis (Pipeline vs. Retrieval Stage)
# ---------------------------------------------------------------------------
def generate_chart3():
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5.2), dpi=300)

    # Panel A: Full Pipeline Latency (Seconds)
    modes_pipeline = ["LLM-Only\n(Zero-Shot)", "Standard RAG\n(Dense)", "Evidence-Aware\n(Anchored)"]
    pipeline_means = [24.02, 51.63, 50.51]
    pipeline_medians = [23.91, 50.66, 48.26]
    pipeline_errors = [2.35, 7.85, 13.10]

    x1 = np.arange(len(modes_pipeline))
    w = 0.35

    ax1.bar(x1 - w/2, pipeline_means, w, yerr=pipeline_errors, capsize=4, label="Mean Wall Time (s)", color="#3182CE", alpha=0.9, edgecolor="#1A365D")
    ax1.bar(x1 + w/2, pipeline_medians, w, label="Median Wall Time (s)", color="#63B3ED", alpha=0.9, edgecolor="#2B6CB0")
    ax1.set_ylabel("Latency (Seconds)")
    ax1.set_title("A. Full Pipeline Triage Latency\n(End-to-End Alert Analysis)", pad=12)
    ax1.set_xticks(x1)
    ax1.set_xticklabels(modes_pipeline)
    ax1.set_ylim(0, 75)
    ax1.grid(axis="y", alpha=0.7)
    ax1.legend(loc="upper left")

    for i, v in enumerate(pipeline_means):
        ax1.annotate(f"{v:.1f}s", xy=(x1[i] - w/2, v + pipeline_errors[i] + 1.5), ha="center", fontsize=8.5, weight="bold")
    for i, v in enumerate(pipeline_medians):
        ax1.annotate(f"{v:.1f}s", xy=(x1[i] + w/2, v + 1.5), ha="center", fontsize=8.5)

    # Panel B: Retrieval Search Latency (Milliseconds)
    methods_retrieval = ["Standard RAG\n(Unanchored)", "Evidence-Aware\n(Anchored)", "Token Hashing\n(Baseline)"]
    search_latencies = [51.5, 240.2, 38.9]
    colors_retrieval = [COLOR_STD_RAG, COLOR_EVID_RAG, COLOR_HASHING]

    x2 = np.arange(len(methods_retrieval))
    bars2 = ax2.bar(x2, search_latencies, width=0.5, color=colors_retrieval, alpha=0.9, edgecolor="#333333")
    ax2.set_ylabel("Search Latency (Milliseconds)")
    ax2.set_title("B. Knowledge Retrieval Stage Latency\n(Qdrant Index Query Execution)", pad=12)
    ax2.set_xticks(x2)
    ax2.set_xticklabels(methods_retrieval)
    ax2.set_ylim(0, 300)
    ax2.grid(axis="y", alpha=0.7)

    for bar in bars2:
        h = bar.get_height()
        ax2.annotate(f"{h:.1f} ms", xy=(bar.get_x() + bar.get_width()/2, h + 6),
                     ha="center", va="bottom", fontsize=9, weight="bold")

    plt.tight_layout()
    fig.savefig(OUT_DIR / "chart3_latency_analysis.png", dpi=300)
    fig.savefig(OUT_DIR / "chart3_latency_analysis.svg")
    plt.close(fig)
    print("Generated Chart 3: Latency Analysis")


# ---------------------------------------------------------------------------
# Chart 4: Scenario-Level Category Performance Heatmap
# ---------------------------------------------------------------------------
def generate_chart4():
    # 10 Categories in Dataset v2
    categories = [
        "Credential Access",
        "Execution",
        "Impact",
        "Privilege Escalation",
        "Persistence",
        "Command & Control",
        "Exfiltration",
        "Initial Access",
        "Defense Evasion",
        "Benign Controls",
    ]

    # Map records to category
    cat_records = {cat: {"llm_only": [], "standard_rag": [], "evidence_aware": []} for cat in categories}
    cat_display_map = {
        "credential_access": "Credential Access",
        "execution": "Execution",
        "impact": "Impact",
        "privilege_escalation": "Privilege Escalation",
        "persistence": "Persistence",
        "command_and_control": "Command & Control",
        "exfiltration": "Exfiltration",
        "initial_access": "Initial Access",
        "defense_evasion": "Defense Evasion",
        "benign_control": "Benign Controls",
    }

    for r in records:
        cat_key = r.get("category", "")
        cat_name = cat_display_map.get(cat_key)
        if cat_name and cat_name in cat_records:
            cat_records[cat_name][r["mode"]].append(r)

    # Compute mean F1 per category (for benign, accuracy)
    matrix = np.zeros((len(categories), 3))

    for idx, cat in enumerate(categories):
        for m_idx, mode in enumerate(["llm_only", "standard_rag", "evidence_aware"]):
            recs = cat_records[cat][mode]
            if cat == "Benign Controls":
                acc = np.mean([1.0 if (r.get("benign_eval") or {}).get("correctly_benign") else 0.0 for r in recs])
                matrix[idx, m_idx] = acc
            else:
                f1_list = [r["technique_prf1"]["f1"] for r in recs if r.get("technique_prf1") and r["technique_prf1"]["f1"] is not None]
                matrix[idx, m_idx] = np.mean(f1_list) if f1_list else 0.0

    fig, ax = plt.subplots(figsize=(8, 7.5), dpi=300)
    im = ax.imshow(matrix, cmap="YlGn", vmin=0.4, vmax=1.0, aspect="auto")

    ax.set_xticks(np.arange(3))
    ax.set_yticks(np.arange(len(categories)))
    ax.set_xticklabels(["LLM-Only", "Standard RAG", "Evidence-Aware"], fontsize=10, weight="bold")
    ax.set_yticklabels(categories, fontsize=10, weight="semibold")

    # Add text annotations inside cells
    for i in range(len(categories)):
        for j in range(3):
            val = matrix[i, j]
            text_color = "white" if val > 0.85 else "#1A202C"
            label = f"{val:.2f}"
            if categories[i] == "Benign Controls":
                label += " (Acc)"
            else:
                label += " (F1)"
            ax.text(j, i, label, ha="center", va="center", color=text_color, fontsize=9.5, weight="bold")

    ax.set_title("Scenario Category Performance Matrix\n(Mean Technique F1 on Attacks / Severity Accuracy on Benign Controls)", pad=15)
    cbar = ax.figure.colorbar(im, ax=ax, fraction=0.035, pad=0.04)
    cbar.ax.set_ylabel("Score (0.0 - 1.0)", rotation=-90, va="bottom", fontsize=10, weight="semibold")

    plt.tight_layout()
    fig.savefig(OUT_DIR / "chart4_scenario_performance_heatmap.png", dpi=300)
    fig.savefig(OUT_DIR / "chart4_scenario_performance_heatmap.svg")
    plt.close(fig)
    print("Generated Chart 4: Category Performance Heatmap")


# ---------------------------------------------------------------------------
# Chart 5: Technical Contribution & Retrieval Pipeline Infographic
# ---------------------------------------------------------------------------
def generate_chart5():
    fig, ax = plt.subplots(figsize=(11, 6), dpi=300)
    ax.axis("off")

    # Draw pipeline boxes
    boxes = [
        {"x": 0.04, "y": 0.55, "w": 0.16, "h": 0.32, "title": "1. Telemetry Ingestion", "desc": "Wazuh Alert Payload\n• rule.id, level, description\n• rule.mitre.id tags\n• IPs, ports, process, host", "color": "#EBF8FF", "border": "#3182CE"},
        {"x": 0.23, "y": 0.55, "w": 0.17, "h": 0.32, "title": "2. Context Extraction", "desc": "Operational Entity Extractor\n• Canonicalize technique IDs\n• Extract CVEs from text\n• Deterministic keyword filter", "color": "#EDFDFD", "border": "#319795"},
        {"x": 0.43, "y": 0.55, "w": 0.20, "h": 0.32, "title": "3. Entity-Anchored Retrieval", "desc": "Hybrid Search Engine\n• Dense Cosine ANN search\n• Exact payload ID filtering\n• Anchored rank prioritization\n(Recall@1: 90.0% vs 22.5%)", "color": "#F0FFF4", "border": "#38A169"},
        {"x": 0.66, "y": 0.55, "w": 0.15, "h": 0.32, "title": "4. Grounded LLM", "desc": "Local Ollama (Qwen3:8B)\n• Zero-temp inference\n• Strict JSON schema\n• UUID chunk citations\n• Anti-injection prompt", "color": "#FAF5FF", "border": "#805AD5"},
        {"x": 0.84, "y": 0.55, "w": 0.14, "h": 0.32, "title": "5. Citation Verify", "desc": "Provenance Engine\n• Cross-check cited IDs\n• Suppress fake citations\n(97.3% Valid Ref Rate)\n• Save trace & graph", "color": "#FFF5F5", "border": "#E53E3E"},
    ]

    for b in boxes:
        rect = plt.Rectangle((b["x"], b["y"]), b["w"], b["h"], facecolor=b["color"], edgecolor=b["border"], linewidth=2, transform=ax.transAxes, zorder=2)
        ax.add_patch(rect)
        ax.text(b["x"] + b["w"]/2, b["y"] + b["h"] - 0.05, b["title"], ha="center", va="center", transform=ax.transAxes, fontsize=10, weight="bold", color=b["border"], zorder=3)
        ax.text(b["x"] + b["w"]/2, b["y"] + b["h"]/2 - 0.03, b["desc"], ha="center", va="center", transform=ax.transAxes, fontsize=8.2, color="#2D3748", zorder=3)

    # Connecting arrows
    for i in range(len(boxes) - 1):
        x_start = boxes[i]["x"] + boxes[i]["w"]
        x_end = boxes[i+1]["x"]
        y_pos = 0.71
        ax.annotate("", xy=(x_end, y_pos), xytext=(x_start, y_pos),
                    xycoords="axes fraction", textcoords="axes fraction",
                    arrowprops=dict(arrowstyle="->", color="#718096", lw=2.5, mutation_scale=15), zorder=4)

    # Lower comparison cards
    card_w = 0.28
    card_h = 0.35
    card_y = 0.08

    cards = [
        {"x": 0.05, "title": "Key Contribution 1: Hybrid Retrieval", "desc": "• Unanchored dense retrieval fails on specialized tokens (Recall@1 = 22.5%).\n• Entity anchoring adds exact-identifier filtering to dense embeddings.\n• Restores Recall@1 to 90.0% in 240 ms.", "color": "#F0FFF4", "border": "#38A169"},
        {"x": 0.36, "title": "Key Contribution 2: Vulnerability Grounding", "desc": "• Parametric memory failed on Log4Shell (CVE F1 = 0.0).\n• Retrieval grounded the model to achieve CVE F1 = 1.0.\n• Negative controls verified 100% true-negative abstention on 39 non-CVE cases.", "color": "#EBF8FF", "border": "#3182CE"},
        {"x": 0.67, "title": "Key Contribution 3: Verifiable Provenance", "desc": "• Strict citation checking caught ungrounded IDs (Case 22).\n• Replaces opaque zero-shot outputs with verifiable evidence citations (97.3% validity).\n• Full SQLite/PostgreSQL execution trace and graph.", "color": "#FAF5FF", "border": "#805AD5"},
    ]

    for c in cards:
        rect = plt.Rectangle((c["x"], card_y), card_w, card_h, facecolor=c["color"], edgecolor=c["border"], linewidth=1.5, transform=ax.transAxes, zorder=2)
        ax.add_patch(rect)
        ax.text(c["x"] + card_w/2, card_y + card_h - 0.05, c["title"], ha="center", va="center", transform=ax.transAxes, fontsize=9.5, weight="bold", color=c["border"], zorder=3)
        ax.text(c["x"] + 0.02, card_y + card_h/2 - 0.04, c["desc"], ha="left", va="center", transform=ax.transAxes, fontsize=8.2, color="#2D3748", zorder=3)

    ax.set_title("Evidence-Aware SOC Analysis Architecture & Technical Contributions", fontsize=13, weight="bold", pad=20)
    plt.tight_layout()
    fig.savefig(OUT_DIR / "chart5_technical_architecture.png", dpi=300)
    fig.savefig(OUT_DIR / "chart5_technical_architecture.svg")
    plt.close(fig)
    print("Generated Chart 5: Technical Architecture")


if __name__ == "__main__":
    generate_chart1()
    generate_chart2()
    generate_chart3()
    generate_chart4()
    generate_chart5()
    print("All charts successfully generated in:", OUT_DIR)

