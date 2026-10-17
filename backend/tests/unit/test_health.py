import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/health/")
    assert response.status_code == 200
    body = response.json()
    # Process-level status remains stable.
    assert body["status"] == "ok"
    assert body["service"] == "soc-assistant"
    # Real per-dependency checks are reported (not just a static ok).
    assert "services" in body
    for name in ("postgres", "qdrant", "ollama", "wazuh"):
        assert name in body["services"]
    # The Wazuh mode must be reported honestly (mock or real).
    assert body["services"]["wazuh"]["mode"] in ("mock", "real")
