import asyncio
import sys
import logging
from pathlib import Path

# Add backend to path so we can import app
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings
from app.rag.retriever import Retriever
from app.rag.knowledge.vectorstore.qdrant import QdrantIndex
from app.rag.knowledge.embeddings import build_embedding_provider
from app.security.schemas import RetrievalQuery, RetrievalQuerySet

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("test_retrieval")

async def main():
    logger.info("Initializing Retrieval Pipeline...")
    embedding_provider = build_embedding_provider()
    logger.info(
        "embedding_provider=%s model=%s dimension=%d",
        settings.EMBEDDING_PROVIDER,
        embedding_provider.model_name,
        embedding_provider.dimension,
    )
    index = QdrantIndex(
        url=settings.QDRANT_URL or "http://localhost:6333",
        collection=settings.QDRANT_COLLECTION,
        api_key=settings.QDRANT_API_KEY,
        embedding_provider=embedding_provider
    )
    retriever = Retriever(index=index, embedding_provider=embedding_provider)

    query = RetrievalQuery(
        query_id="test_query_1",
        category="mitre",
        text="T1110 brute force non-existent user authentication attempt",
    )
    
    query_set = RetrievalQuerySet(
        alert_id="1",
        mitre_queries=[query]
    )
    
    logger.info(f"Querying Qdrant for: {query.text}")
    
    # Note the embedding provider actually in use (hashing = deterministic
    # test-only; semantic = real retrieval quality).
    if "hashing" in embedding_provider.model_name.lower():
        logger.info("LIMITATION: local-hashing embedding is deterministic but NOT semantically meaningful.")
    else:
        logger.info(f"Semantic retrieval active: {embedding_provider.model_name}")
    
    evidence_set = retriever.retrieve_query_set(query_set, top_k=5)
    
    logger.info(f"Retrieved {len(evidence_set.evidence)} evidence items.")
    for idx, item in enumerate(evidence_set.evidence):
        print(f"\n--- Evidence {idx + 1} ---")
        print(f"Evidence ID: {item.evidence_id}")
        print(f"Document ID: {item.document_id}")
        print(f"Source: {item.source}")
        print(f"Title: {item.title}")
        print(f"Score: {item.similarity_score}")
        print(f"Provenance/Citation: {item.source_identifier} - {item.source_url}")
        print(f"Content: {item.content[:200]}...")

if __name__ == "__main__":
    asyncio.run(main())
