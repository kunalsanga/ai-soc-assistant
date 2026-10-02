from app.llm.provider import LLMProvider
from app.llm.schemas import LLMRequest, LLMResponse, LLMUsage

class MockLLMProvider(LLMProvider):
    def __init__(self, model_name: str = "mock-model", provider_name: str = "mock-provider"):
        self._model = model_name
        self._provider = provider_name
        self.last_request = None
        
    def generate(self, request: LLMRequest) -> LLMResponse:
        self.last_request = request
        return LLMResponse(
            content="MOCK_RESPONSE",
            model=self._model,
            provider=self._provider,
            usage=LLMUsage(
                prompt_tokens=10,
                completion_tokens=20,
                total_tokens=30,
            ),
            metadata={"mocked": True}
        )
