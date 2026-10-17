"""Health route — real dependency checks with bounded timeouts.

Returns:
  - process-level status (always "ok" when this handler executes)
  - per-service connectivity: PostgreSQL, Qdrant, Ollama (configured model
    availability is checked explicitly), and the active Wazuh source mode.

A service being configured does NOT mean it is reachable — each entry
reports the actual check result. Never exposes secrets.
"""
from fastapi import APIRouter

from app.core.config import settings
from app.services.health import check_services

router = APIRouter()


@router.get("/")
async def health_check():
    services = await check_services()
    dependencies_ok = all(
        svc.get("status") in ("connected", "reachable", "using_mock_client", "real_mode")
        for svc in services.values()
    )
    return {
        "status": "ok",
        "service": "soc-assistant",
        "dependencies_ok": dependencies_ok,
        "services": services,
        "config": {
            "llm_provider": settings.LLM_PROVIDER,
            "llm_model": settings.LLM_MODEL,
            "embedding_provider": settings.EMBEDDING_PROVIDER,
            "qdrant_collection": settings.QDRANT_COLLECTION,
            "wazuh_mode": settings.WAZUH_MODE,
        },
    }
