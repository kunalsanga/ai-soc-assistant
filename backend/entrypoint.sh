#!/bin/sh
set -e

echo "=========================================================="
echo " Starting SOC Assistant Backend Container"
echo "=========================================================="

echo "[entrypoint] Checking database availability..."
python - << 'EOF'
import socket
import time
import os
import urllib.parse
import sys

db_url = os.environ.get("DATABASE_URL", "postgresql+asyncpg://soc_user:soc_password@db:5432/soc_db")
cleaned_url = db_url.replace("postgresql+asyncpg://", "http://").replace("postgresql+psycopg2://", "http://")
parsed = urllib.parse.urlparse(cleaned_url)
host = parsed.hostname or "db"
port = parsed.port or 5432

print(f"[entrypoint] Connecting to database at {host}:{port}...")
start_time = time.time()
while time.time() - start_time < 60:
    try:
        with socket.create_connection((host, port), timeout=2):
            print(f"[entrypoint] Database at {host}:{port} is reachable.")
            sys.exit(0)
    except (socket.error, OSError):
        time.sleep(1)

print("[entrypoint] Warning: Database connection timeout reached. Attempting to proceed anyway.")
EOF

echo "[entrypoint] Running database migrations..."
alembic upgrade head

echo "[entrypoint] Checking knowledge base & alert seed data..."
python - << 'EOF'
import asyncio
import os
import sys

async def auto_seed():
    # 1. Check & ingest knowledge base
    try:
        from app.rag.knowledge.pipeline import KnowledgeIngestionPipeline
        from app.rag.knowledge.embeddings import build_embedding_provider
        from app.core.config import settings

        pipeline = KnowledgeIngestionPipeline(embedding_provider=build_embedding_provider())
        index = pipeline._get_index()
        client = index._get_client()
        total = client.count(collection_name=index._collection, exact=True)
        count = total.count
        if count == 0:
            print("[entrypoint] Knowledge index is empty. Ingesting MITRE ATT&CK & NVD knowledge...")
            from scripts.ingest import main as ingest_main
            await ingest_main()
            print("[entrypoint] Knowledge ingestion completed.")
        else:
            print(f"[entrypoint] Knowledge index already contains {count} indexed chunks.")
    except Exception as e:
        print(f"[entrypoint] Knowledge base note: {e}")

    # 2. Check & sync initial mock alerts
    try:
        from app.db.database import AsyncSessionLocal
        from app.db.models.alert import Alert
        from sqlalchemy.future import select
        from app.wazuh.service import AlertService
        from app.wazuh.client import get_wazuh_client

        async with AsyncSessionLocal() as session:
            res = await session.execute(select(Alert))
            alerts = res.scalars().all()
            if len(alerts) == 0:
                print("[entrypoint] Database has no alerts. Auto-syncing initial alerts...")
                client = get_wazuh_client()
                svc = AlertService(client=client)
                await svc.sync_alerts(session, limit=50)
                print("[entrypoint] Initial alerts synced successfully.")
            else:
                print(f"[entrypoint] Database already has {len(alerts)} alerts.")
    except Exception as e:
        print(f"[entrypoint] Alert sync note: {e}")

asyncio.run(auto_seed())
EOF

echo "[entrypoint] Starting Uvicorn API server on 0.0.0.0:8000..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
