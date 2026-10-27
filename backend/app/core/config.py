from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "SOC Assistant"
    API_V1_STR: str = "/api/v1"

    # CORS: comma-separated allow-list of browser origins (dev default).
    # Never use "*" together with credentials.
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:4173,http://localhost:8000"

    DATABASE_URL: str
    
    WAZUH_BASE_URL: str = ""
    WAZUH_USERNAME: str = ""
    WAZUH_PASSWORD: str = ""
    WAZUH_API_URL: str = ""
    WAZUH_VERIFY_SSL: bool = True
    WAZUH_MODE: str = "mock"  # "mock" | "real" — mock keeps dev working without a live Wazuh
    
    # Wazuh Indexer (OpenSearch-compatible API) configuration
    WAZUH_CONNECTOR_TYPE: str = "indexer"  # "indexer" (port 9200) | "manager" (port 55000)
    WAZUH_INDEXER_URL: str = ""            # e.g. "https://wazuh.internal:9200"
    WAZUH_INDEX_PATTERN: str = "wazuh-alerts-*"
    WAZUH_INDEXER_USERNAME: str = ""
    WAZUH_INDEXER_PASSWORD: str = ""
    WAZUH_CA_BUNDLE: str = ""              # path to custom CA certificate if needed
    
    # Data source selection: "demo" | "live_wazuh" | "dataset_replay"
    DEFAULT_DATA_SOURCE: str = "demo"
    
    QDRANT_URL: str = ""
    QDRANT_API_KEY: str = ""
    QDRANT_COLLECTION: str = "security_knowledge"

    # --- Knowledge base (Phase 4A) -----------------------------------------
    KNOWLEDGE_DATA_DIR: str = "knowledge"
    # Embedding provider selection: "local-hashing" (deterministic tests) or
    # "semantic" (real local sentence-transformers model — see
    # SEMANTIC_EMBEDDING_MODEL). Switching providers requires re-indexing.
    EMBEDDING_PROVIDER: str = "local-hashing"
    SEMANTIC_EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_MODEL: str = "local-hashing"  # legacy alias, kept for compat
    EMBEDDING_DIMENSION: int = 256
    CHUNK_SIZE: int = 1200
    CHUNK_OVERLAP: int = 150
    EMBEDDING_BATCH_SIZE: int = 64
    
    # --- Retrieval (Phase 4B) ----------------------------------------------
    RETRIEVAL_TOP_K: int = 5
    RETRIEVAL_SCORE_THRESHOLD: float = 0.0
    
    # --- LLM Analysis (Phase 5) --------------------------------------------
    LLM_PROVIDER: str = "ollama"
    LLM_MODEL: str = "qwen3:8b"
    LLM_BASE_URL: str = "http://localhost:11434"
    LLM_API_KEY: str = ""
    LLM_TEMPERATURE: float = 0.0
    LLM_MAX_TOKENS: int = 2000
    LLM_TIMEOUT: float = 300.0
    # Thinking-mode toggle for reasoning models (e.g. qwen3). Disabled by
    # default: thinking tokens consume num_predict and delay content output.
    LLM_THINK: bool = False
    
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

settings = Settings()
