import asyncio
import os
import sys
import httpx
import logging
from pathlib import Path

# Add backend to path so we can import app
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings
from app.rag.knowledge.pipeline import KnowledgeIngestionPipeline
from app.rag.knowledge.sources.mitre import MitreAttackSource
from app.rag.knowledge.sources.nvd import NvdCveSource
from app.rag.knowledge.embeddings import build_embedding_provider

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("ingest")

MITRE_URL = "https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json"

async def download_file(url: str, dest_path: Path):
    logger.info(f"Downloading {url} to {dest_path}...")
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    async with httpx.AsyncClient(follow_redirects=True) as client:
        async with client.stream("GET", url) as response:
            response.raise_for_status()
            with open(dest_path, "wb") as f:
                async for chunk in response.aiter_bytes():
                    f.write(chunk)
    logger.info(f"Downloaded {dest_path.name} successfully.")

async def main():
    knowledge_dir = Path(settings.KNOWLEDGE_DATA_DIR)
    mitre_path = knowledge_dir / "enterprise-attack.json"
    
    if not mitre_path.exists():
        logger.info("MITRE dataset not found locally.")
        await download_file(MITRE_URL, mitre_path)
    else:
        logger.info(f"MITRE dataset found at {mitre_path}.")

    logger.info("Starting knowledge ingestion pipeline...")

    embedding_provider = build_embedding_provider()
    logger.info(
        "embedding_provider=%s model=%s dimension=%d",
        settings.EMBEDDING_PROVIDER,
        embedding_provider.model_name,
        embedding_provider.dimension,
    )

    pipeline = KnowledgeIngestionPipeline(embedding_provider=embedding_provider)
    # Switching providers changes vector dimensions; recreate the collection
    # explicitly when it no longer matches (it is re-populated right after).
    pipeline._get_index().recreate_if_dimension_mismatch()
    mitre_source = MitreAttackSource(mitre_path)

    # NVD/CVE is a second real knowledge source; ingest it whenever its
    # export exists (build it with scripts/fetch_nvd.py).
    nvd_path = knowledge_dir / "nvd-cves.json"
    sources = [mitre_source]
    if nvd_path.exists():
        sources.append(NvdCveSource(nvd_path))
        logger.info(f"NVD export found at {nvd_path}; including NVD/CVE source.")
    else:
        logger.info("No NVD export found; ingesting MITRE only.")

    result = pipeline.run(sources, dedupe_documents=True)
    
    logger.info("Ingestion complete.")
    logger.info(f"Result summary: {result.summary()}")
    
    if not result.ok:
        logger.error("Ingestion had errors!")
        for error in result.source_errors:
            logger.error(error)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
