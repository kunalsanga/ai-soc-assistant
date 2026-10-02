"""Vector storage for the knowledge base (Qdrant).

Phase 4A boundary: indexing/upsert only. Search/retrieval is Phase 4B.
"""
from .qdrant import QdrantIndex, VectorStoreError

__all__ = ["QdrantIndex", "VectorStoreError"]
