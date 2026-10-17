"""Fetch a small, reproducible NVD/CVE corpus (Milestone 4).

Queries the NVD API 2.0 for a curated, project-relevant set of CVEs (no bulk
download): keyword sets matching the project's alert categories plus the
specific CVEs referenced by the evaluation dataset. Saves one JSON export to
KNOWLEDGE_DATA_DIR/nvd-cves.json for the NvdCveSource adapter.

Respects NVD public rate limits (no API key: 5 requests / 30 s).

Usage:
    python scripts/fetch_nvd.py
"""
import asyncio
import json
import sys
import time
from pathlib import Path

import httpx

# Add backend to path so we can import app
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings

NVD_API = "https://services.nvd.nist.gov/rest/json/cves/2.0"

# Targeted searches: security areas relevant to the SOC alert categories.
KEYWORD_QUERIES = [
    "OpenSSH",
    "Apache Log4j",
    "Windows SMB remote code execution",
    "sudo privilege escalation",
    "webshell",
]
# Explicit CVEs referenced anywhere in the project (eval dataset, docs).
EXPLICIT_CVE_IDS = [
    "CVE-2024-6387",   # regreSSHion, OpenSSH RCE
    "CVE-2023-48795",  # Terrapin, OpenSSH
    "CVE-2021-44228",  # Log4Shell
    "CVE-2017-0144",   # EternalBlue / MS17-010
    "CVE-2023-38545",  # curl SOCKS5 heap overflow
]

REQUEST_PAUSE_SECONDS = 7.0  # well within the public rate limit


async def fetch(client: httpx.AsyncClient, params: dict) -> dict:
    for attempt in range(3):
        response = await client.get(NVD_API, params=params)
        if response.status_code == 403 and attempt < 2:
            # Public rate limit: back off and retry.
            print(f"  rate limited, backing off {REQUEST_PAUSE_SECONDS * 4:.0f}s ...")
            await asyncio.sleep(REQUEST_PAUSE_SECONDS * 4)
            continue
        response.raise_for_status()
        return response.json()
    response.raise_for_status()
    return {}


async def main() -> int:
    out_path = Path(settings.KNOWLEDGE_DATA_DIR) / "nvd-cves.json"
    merged: dict[str, dict] = {}

    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        for cve_id in EXPLICIT_CVE_IDS:
            print(f"Fetching explicit {cve_id} ...")
            body = await fetch(client, {"cveId": cve_id})
            for item in body.get("vulnerabilities", []):
                cve = item.get("cve", {})
                if cve.get("id"):
                    merged[cve["id"]] = cve
            await asyncio.sleep(REQUEST_PAUSE_SECONDS)

        for keyword in KEYWORD_QUERIES:
            print(f"Fetching keyword={keyword!r} ...")
            body = await fetch(client, {"keywordSearch": keyword, "resultsPerPage": 30})
            for item in body.get("vulnerabilities", []):
                cve = item.get("cve", {})
                if cve.get("id"):
                    merged[cve["id"]] = cve
            await asyncio.sleep(REQUEST_PAUSE_SECONDS)

    corpus = {
        "fetched_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "NVD API 2.0 (services.nvd.nist.gov)",
        "totalResults": len(merged),
        "vulnerabilities": [{"cve": cve} for cve in sorted(merged.values(), key=lambda c: c.get("id", ""))],
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(corpus, indent=2), encoding="utf-8")
    print(f"Saved {len(merged)} CVEs to {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
