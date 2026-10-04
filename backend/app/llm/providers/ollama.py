import httpx
import logging
from typing import Optional

from app.core.config import settings
from app.llm.provider import LLMProvider
from app.llm.schemas import LLMRequest, LLMResponse, LLMUsage
from app.llm.errors import LLMProviderError

logger = logging.getLogger(__name__)

class OllamaLLMProvider(LLMProvider):
    def __init__(self, base_url: Optional[str] = None, model: Optional[str] = None):
        self._base_url = base_url or settings.LLM_BASE_URL or "http://localhost:11434"
        self._model = model or settings.LLM_MODEL or "mock-model"
        self._provider = "ollama"
        self._client = httpx.Client(timeout=60.0)

    def generate(self, request: LLMRequest) -> LLMResponse:
        url = f"{self._base_url.rstrip('/')}/api/chat"
        
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": request.system_prompt},
                {"role": "user", "content": request.user_prompt}
            ],
            "options": {
                "temperature": request.temperature,
                "num_predict": request.max_tokens
            },
            "stream": False
        }

        try:
            response = self._client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
        except httpx.ConnectError as e:
            raise LLMProviderError(f"Failed to connect to Ollama at {self._base_url}") from e
        except httpx.TimeoutException as e:
            raise LLMProviderError("Ollama request timed out after 60s") from e
        except httpx.HTTPStatusError as e:
            raise LLMProviderError(f"Ollama returned HTTP {e.response.status_code}") from e
        except Exception as e:
            raise LLMProviderError(f"Unexpected error calling Ollama: {str(e)}") from e

        if not isinstance(data, dict):
            raise LLMProviderError("Ollama returned invalid JSON structure (not a dict)")

        message = data.get("message", {})
        content = message.get("content")
        
        if content is None:
            raise LLMProviderError("Ollama response missing 'message.content'")

        usage = LLMUsage(
            prompt_tokens=data.get("prompt_eval_count", 0),
            completion_tokens=data.get("eval_count", 0),
            total_tokens=data.get("prompt_eval_count", 0) + data.get("eval_count", 0)
        )

        return LLMResponse(
            content=content,
            model=data.get("model", self._model),
            provider=self._provider,
            usage=usage,
            metadata={
                "done_reason": data.get("done_reason"),
                "total_duration": data.get("total_duration"),
                "load_duration": data.get("load_duration"),
                "prompt_eval_duration": data.get("prompt_eval_duration"),
                "eval_duration": data.get("eval_duration"),
            }
        )
