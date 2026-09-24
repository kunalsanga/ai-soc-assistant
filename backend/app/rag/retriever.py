from abc import ABC, abstractmethod
from typing import List, Dict, Any

class BaseRetriever(ABC):
    @abstractmethod
    def retrieve(self, alert_data: Dict[str, Any], top_k: int = 5) -> List[Dict[str, Any]]:
        pass

class PlaceholderRetriever(BaseRetriever):
    def retrieve(self, alert_data: Dict[str, Any], top_k: int = 5) -> List[Dict[str, Any]]:
        # In the future, this will connect to Qdrant to retrieve MITRE and NVD data
        return []
