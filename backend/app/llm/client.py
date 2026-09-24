from abc import ABC, abstractmethod
from typing import Dict, Any, List

class BaseLLMClient(ABC):
    @abstractmethod
    async def analyze(self, alert: Dict[str, Any], evidence: List[Dict[str, Any]]) -> Dict[str, Any]:
        pass

class PlaceholderLLMClient(BaseLLMClient):
    async def analyze(self, alert: Dict[str, Any], evidence: List[Dict[str, Any]]) -> Dict[str, Any]:
        # In the future, this will call the LLM API to generate analysis
        return {
            "summary": "AI analysis pipeline not connected yet.",
            "severity_assessment": "Unknown",
            "explanation": "Please connect the LLM and RAG components to view the analysis.",
            "recommended_investigation": "No recommendations available at this time.",
            "confidence": "Low"
        }
