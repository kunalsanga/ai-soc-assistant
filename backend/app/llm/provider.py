from abc import ABC, abstractmethod
from app.llm.schemas import LLMRequest, LLMResponse

class LLMProvider(ABC):
    @abstractmethod
    def generate(self, request: LLMRequest) -> LLMResponse:
        """Generate a response from the LLM given a request."""
