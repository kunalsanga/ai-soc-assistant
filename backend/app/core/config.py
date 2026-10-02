from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "SOC Assistant"
    API_V1_STR: str = "/api/v1"
    
    DATABASE_URL: str
    
    WAZUH_BASE_URL: str = ""
    WAZUH_USERNAME: str = ""
    WAZUH_PASSWORD: str = ""
    WAZUH_API_URL: str = ""
    WAZUH_VERIFY_SSL: bool = True
    WAZUH_MODE: str = "mock"  # "mock" | "real" — mock keeps dev workin without a live Wazuh
    
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = ""
    LLM_MODEL: str = ""
    
    QDRANT_URL: str = ""
    QDRANT_API_KEY: str = ""
    QDRANT_COLLECTION: str = "security_knowledge"

    # --- Knowledge base (Phase 4A) -----------------------------------------
    KNOWLEDGE_DATA_DIR: str = "knowledge"
    EMBEDDING_MODEL: str = "local-hashing"  # "local-hashing" | future providers
    EMBEDDING_DIMENSION: int = 256
    CHUNK_SIZE: int = 1200
    CHUNK_OVERLAP: int = 150
    EMBEDDING_BATCH_SIZE: int = 64
    
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

settings = Settings()
