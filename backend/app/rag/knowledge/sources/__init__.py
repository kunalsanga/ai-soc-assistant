"""Knowledge source adapters.

A KnowledgeSource knows how to load raw records from ONE authoritative
source and normalize them into the common KnowledgeDocument model. The rest
of the pipeline (chunking → embedding → indexing) is source-agnostic.
"""
from .base import KnowledgeSource, KnowledgeSourceError
from .mitre import MitreAttackSource
from .nvd import NvdCveSource

__all__ = ["KnowledgeSource", "KnowledgeSourceError", "MitreAttackSource", "NvdCveSource"]
