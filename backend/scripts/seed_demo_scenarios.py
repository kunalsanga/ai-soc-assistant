"""Idempotent seed script for the cybersecurity demonstration dataset.

Loads 52 realistic security alerts across 10 scenarios into PostgreSQL.
Idempotent: skips any alert whose external_alert_id already exists in the database.
"""
import asyncio
import json
import logging
from sqlalchemy import select
from app.db.database import AsyncSessionLocal
from app.db.models.alert import Alert
from app.data.demo.scenarios import get_demo_alerts, SCENARIOS_MANIFEST

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed_demo")

async def seed_demo_alerts() -> dict:
    raw_alerts = get_demo_alerts()
    created_count = 0
    skipped_count = 0

    async with AsyncSessionLocal() as session:
        # Check existing external alert IDs
        res = await session.execute(select(Alert.external_alert_id))
        existing_ids = set(res.scalars().all())

        for item in raw_alerts:
            ext_id = item["id"]
            if ext_id in existing_ids:
                skipped_count += 1
                continue

            rule = item.get("rule", {})
            agent = item.get("agent", {})
            data = item.get("data", {})

            alert = Alert(
                external_alert_id=ext_id,
                timestamp=item.get("timestamp", ""),
                severity=int(rule.get("level", 5)),
                rule_id=str(rule.get("id", "0")),
                rule_description=str(rule.get("description", "Security Alert")),
                agent_name=agent.get("name"),
                source_ip=data.get("srcip"),
                destination_ip=data.get("dstip"),
                username=data.get("dstuser") or data.get("user"),
                raw_data=json.dumps(item),
                status="open",
            )
            session.add(alert)
            created_count += 1

        await session.commit()

    logger.info(f"Demo seeding finished: {created_count} created, {skipped_count} skipped (already existed).")
    return {
        "status": "ok",
        "created": created_count,
        "skipped": skipped_count,
        "total_scenario_records": len(raw_alerts),
        "manifest": SCENARIOS_MANIFEST,
    }

if __name__ == "__main__":
    asyncio.run(seed_demo_alerts())
