import pytest
from unittest.mock import Mock, patch
from app.rag.schemas import Evidence, EvidenceSet
from app.rag.retriever import Retriever
from app.security.schemas import RetrievalQuery, RetrievalQuerySet
from app.rag.knowledge.embeddings.base import EmbeddingProvider
from app.rag.knowledge.vectorstore.qdrant import QdrantIndex, VectorStoreError

@pytest.fixture
def mock_embedding_provider():
    provider = Mock(spec=EmbeddingProvider)
    # Return a dummy vector
    provider.embed_text.return_value = [0.1, 0.2, 0.3]
    return provider

@pytest.fixture
def mock_qdrant_index():
    index = Mock(spec=QdrantIndex)
    return index

def test_evidence_schema_preserves_provenance():
    evidence = Evidence(
        evidence_id="ev-123",
        query_ids=["q-1"],
        categories=["mitre"],
        source="mitre_attack",
        document_id="doc-1",
        chunk_id="doc-1::0",
        source_identifier="T1110",
        source_url="http://example.com/T1110",
        title="Brute Force",
        content="Testing content",
        similarity_score=0.95,
        chunk_index=0,
        metadata={"foo": "bar"}
    )
    assert evidence.source == "mitre_attack"
    assert evidence.chunk_id == "doc-1::0"
    assert evidence.document_id == "doc-1"
    assert evidence.source_identifier == "T1110"
    assert evidence.source_url == "http://example.com/T1110"
    assert evidence.categories == ["mitre"]
    assert evidence.query_ids == ["q-1"]

def test_retriever_single_query(mock_qdrant_index, mock_embedding_provider):
    retriever = Retriever(index=mock_qdrant_index, embedding_provider=mock_embedding_provider)
    
    query_set = RetrievalQuerySet(
        alert_id="alert-1",
        mitre_queries=[RetrievalQuery(query_id="q1", category="mitre", text="test query")]
    )
    
    mock_qdrant_index.search.return_value = [
        {"score": 0.9, "payload": {"chunk_id": "c1", "source": "mitre", "document_id": "d1", "title": "t1", "content": "c1"}}
    ]
    
    result = retriever.retrieve_query_set(query_set)
    assert isinstance(result, EvidenceSet)
    assert len(result.evidence) == 1
    assert result.evidence[0].chunk_id == "c1"
    assert result.evidence[0].categories == ["mitre"]
    assert result.evidence[0].similarity_score == 0.9
    
    mock_embedding_provider.embed_text.assert_called_once_with("test query")
    mock_qdrant_index.search.assert_called_once()

def test_retriever_multiple_queries_deduplication_and_ranking(mock_qdrant_index, mock_embedding_provider):
    retriever = Retriever(index=mock_qdrant_index, embedding_provider=mock_embedding_provider)
    
    query_set = RetrievalQuerySet(
        alert_id="alert-1",
        mitre_queries=[RetrievalQuery(query_id="q1", category="mitre", text="query A")],
        nvd_queries=[RetrievalQuery(query_id="q2", category="nvd", text="query B")]
    )
    
    # query A returns chunk c1 (score 0.8) and c2 (score 0.9)
    # query B returns chunk c1 (score 0.95) and c3 (score 0.7)
    
    def mock_search(*args, **kwargs):
        if mock_embedding_provider.embed_text.call_count == 1:
            return [
                {"score": 0.8, "payload": {"chunk_id": "c1", "title": "t1", "content": "ct1"}},
                {"score": 0.9, "payload": {"chunk_id": "c2", "title": "t2", "content": "ct2"}}
            ]
        else:
            return [
                {"score": 0.95, "payload": {"chunk_id": "c1", "title": "t1", "content": "ct1"}},
                {"score": 0.7, "payload": {"chunk_id": "c3", "title": "t3", "content": "ct3"}}
            ]
            
    mock_qdrant_index.search.side_effect = mock_search
    
    result = retriever.retrieve_query_set(query_set, top_k=10)
    
    assert len(result.evidence) == 3 # c1, c2, c3
    # c1 gets 0.8 from A, 0.95 from B -> max is 0.95.
    # Scores: c1(0.95), c2(0.9), c3(0.7).
    
    assert result.evidence[0].chunk_id == "c1"
    assert result.evidence[0].similarity_score == 0.95
    assert set(result.evidence[0].query_ids) == {"q1", "q2"}
    assert set(result.evidence[0].categories) == {"mitre", "nvd"}
    
    assert result.evidence[1].chunk_id == "c2"
    assert result.evidence[2].chunk_id == "c3"

def test_retriever_tie_breaking(mock_qdrant_index, mock_embedding_provider):
    retriever = Retriever(index=mock_qdrant_index, embedding_provider=mock_embedding_provider)
    
    query_set = RetrievalQuerySet(
        alert_id="alert-1",
        mitre_queries=[RetrievalQuery(query_id="q1", category="mitre", text="query A")]
    )
    
    # same scores, different chunk ids
    mock_qdrant_index.search.return_value = [
        {"score": 0.5, "payload": {"chunk_id": "B", "content": "c"}},
        {"score": 0.5, "payload": {"chunk_id": "A", "content": "c"}}
    ]
    
    result = retriever.retrieve_query_set(query_set)
    # deterministic tie breaking: chunk_id ascending
    assert result.evidence[0].chunk_id == "A"
    assert result.evidence[1].chunk_id == "B"

def test_retriever_top_k_and_threshold(mock_qdrant_index, mock_embedding_provider):
    retriever = Retriever(index=mock_qdrant_index, embedding_provider=mock_embedding_provider)
    query_set = RetrievalQuerySet(
        alert_id="alert-1",
        mitre_queries=[RetrievalQuery(query_id="q1", category="mitre", text="query A")]
    )
    
    mock_qdrant_index.search.return_value = [
        {"score": 0.9, "payload": {"chunk_id": "c1", "content": "c"}},
        {"score": 0.8, "payload": {"chunk_id": "c2", "content": "c"}},
        {"score": 0.7, "payload": {"chunk_id": "c3", "content": "c"}}
    ]
    
    # Top K = 2
    result = retriever.retrieve_query_set(query_set, top_k=2)
    assert len(result.evidence) == 2
    assert result.evidence[0].chunk_id == "c1"
    assert result.evidence[1].chunk_id == "c2"

def test_retriever_empty_query_set(mock_qdrant_index, mock_embedding_provider):
    retriever = Retriever(index=mock_qdrant_index, embedding_provider=mock_embedding_provider)
    query_set = RetrievalQuerySet(alert_id="alert-1")
    result = retriever.retrieve_query_set(query_set)
    assert len(result.evidence) == 0
    mock_qdrant_index.search.assert_not_called()

def test_retriever_empty_query_text(mock_qdrant_index, mock_embedding_provider):
    retriever = Retriever(index=mock_qdrant_index, embedding_provider=mock_embedding_provider)
    query_set = RetrievalQuerySet(
        alert_id="alert-1",
        mitre_queries=[RetrievalQuery(query_id="q1", category="mitre", text="   ")]
    )
    result = retriever.retrieve_query_set(query_set)
    assert len(result.evidence) == 0
    mock_qdrant_index.search.assert_not_called()

def test_retriever_no_matches(mock_qdrant_index, mock_embedding_provider):
    retriever = Retriever(index=mock_qdrant_index, embedding_provider=mock_embedding_provider)
    query_set = RetrievalQuerySet(
        alert_id="alert-1",
        mitre_queries=[RetrievalQuery(query_id="q1", category="mitre", text="q")]
    )
    mock_qdrant_index.search.return_value = []
    result = retriever.retrieve_query_set(query_set)
    assert len(result.evidence) == 0

def test_retriever_qdrant_failure_handled_safely(mock_qdrant_index, mock_embedding_provider):
    retriever = Retriever(index=mock_qdrant_index, embedding_provider=mock_embedding_provider)
    query_set = RetrievalQuerySet(
        alert_id="alert-1",
        mitre_queries=[
            RetrievalQuery(query_id="q1", category="mitre", text="query A"),
            RetrievalQuery(query_id="q2", category="nvd", text="query B")
        ]
    )
    
    # First query fails, second succeeds
    def mock_search(*args, **kwargs):
        if kwargs.get("query_vector") == [0.1, 0.2, 0.3]: # we always return this vector from mock
            if mock_qdrant_index.search.call_count == 1:
                raise VectorStoreError("Connection lost")
            else:
                return [{"score": 0.9, "payload": {"chunk_id": "c1", "content": "c"}}]
    
    mock_qdrant_index.search.side_effect = mock_search
    
    result = retriever.retrieve_query_set(query_set)
    # Still gets the result from the second query
    assert len(result.evidence) == 1
    assert result.evidence[0].chunk_id == "c1"

def test_retriever_missing_payload_fields(mock_qdrant_index, mock_embedding_provider):
    retriever = Retriever(index=mock_qdrant_index, embedding_provider=mock_embedding_provider)
    query_set = RetrievalQuerySet(
        alert_id="alert-1",
        mitre_queries=[RetrievalQuery(query_id="q1", category="mitre", text="q")]
    )
    # Payload is completely missing chunk_id, should skip
    mock_qdrant_index.search.return_value = [
        {"score": 0.9, "payload": {}}
    ]
    result = retriever.retrieve_query_set(query_set)
    assert len(result.evidence) == 0
