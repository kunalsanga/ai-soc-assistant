"""Service health checks with bounded timeouts.

Distinguishes "the app process is running" from "each external dependency is
actually reachable". Never returns secrets. Each check has a hard timeout so a
dead service cannot stall the API.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Dict

from app.core.config import settings

logger = logging.getLogger(__name__)

SERVICE_CHECK_TIMEOUT = 3.0  # seconds, per service


async def _check_postgres() -> Dict[str, Any]:
    """SELECT 1 against the configured database (bounded)."""
    from app.db.database import engine

    started = time.perf_counter()

    async def _run() -> bool:
        from sqlalchemy import text
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True

    try:
        await asyncio.wait_for(_run(), timeout=SERVICE_CHECK_TIMEOUT)
        return {"status": "connected", "latency_ms": round((time.perf_counter() - started) * 1000)}
    except Exception as exc:  # noqa: BLE001
        logger.warning("postgres_health_failed error=%s", type(exc).__name__)
        return {
            "status": "unreachable",
            "error": f"PostgreSQL is not reachable ({type(exc).__name__})",
        }


async def _check_qdrant() -> Dict[str, Any]:
    import httpx

    url = settings.QDRANT_URL or "http://localhost:6333"
    try:
        async with httpx.AsyncClient(timeout=SERVICE_CHECK_TIMEOUT) as client:
            response = await client.get(f"{url}/collections/{settings.QDRANT_COLLECTION}")
            response.raise_for_status()
            data = response.json()
            result = data.get("result", {})
            status = result.get("status")
            points = result.get("points_count")
            return {
                "status": "connected" if status == "green" else (status or "unknown"),
                "collection": settings.QDRANT_COLLECTION,
                "points_count": points,
            }
    except Exception as exc:  # noqa: BLE001
        logger.warning("qdrant_health_failed error=%s", type(exc).__name__)
        return {
            "status": "unreachable",
            "collection": settings.QDRANT_COLLECTION,
            "error": f"Qdrant is not reachable at {url} ({type(exc).__name__})",
        }


async def _check_ollama() -> Dict[str, Any]:
    import httpx

    url = settings.LLM_BASE_URL or "http://localhost:11434"
    try:
        async with httpx.AsyncClient(timeout=SERVICE_CHECK_TIMEOUT) as client:
            response = await client.get(f"{url}/api/tags")
            response.raise_for_status()
            models = [
                m.get("model") for m in response.json().get("models", [])
                if isinstance(m, dict) and m.get("model")
            ]
            model_available = settings.LLM_MODEL in models
            return {
                "status": "reachable",
                "model": settings.LLM_MODEL,
                "model_available": model_available,
            }
    except Exception as exc:  # noqa: BLE001
        logger.warning("ollama_health_failed error=%s", type(exc).__name__)
        return {
            "status": "unreachable",
            "model": settings.LLM_MODEL,
            "error": f"Ollama is not reachable at {url} ({type(exc).__name__})",
        }


async def check_services() -> Dict[str, Any]:
    """Run all external-dependency checks concurrently."""
    postgres, qdrant, ollama = await asyncio.gather(
        _check_postgres(), _check_qdrant(), _check_ollama()
    )
    return {
        "postgres": {"configured": True, **postgres},
        "qdrant": {"configured": bool(settings.QDRANT_URL), **qdrant},
        "ollama": {"configured": bool(settings.LLM_BASE_URL), **ollama},
        "wazuh": {
            "configured": True,
            "mode": settings.WAZUH_MODE,
            # Honest: the configured mode is what will be used. In "mock" mode
            # alerts come from the bundled mock client and are marked as such.
            "status": "using_mock_client" if settings.WAZUH_MODE == "mock" else "real_mode",
        },
    }
