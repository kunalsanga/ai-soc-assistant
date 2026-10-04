import pytest
from unittest.mock import patch, MagicMock
import httpx

from app.llm.schemas import LLMRequest
from app.llm.providers.ollama import OllamaLLMProvider
from app.llm.errors import LLMProviderError

@pytest.fixture
def provider():
    return OllamaLLMProvider(base_url="http://test-ollama:11434", model="test-model")

@pytest.fixture
def request_obj():
    return LLMRequest(
        system_prompt="sys",
        user_prompt="usr",
        temperature=0.5,
        max_tokens=100
    )

def test_ollama_provider_successful_generation(provider, request_obj):
    with patch("httpx.Client.post") as mock_post:
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "model": "test-model",
            "message": {"role": "assistant", "content": "Hello World"},
            "prompt_eval_count": 10,
            "eval_count": 20,
            "done_reason": "stop"
        }
        mock_post.return_value = mock_response

        response = provider.generate(request_obj)

        assert response.content == "Hello World"
        assert response.model == "test-model"
        assert response.provider == "ollama"
        assert response.usage.prompt_tokens == 10
        assert response.usage.completion_tokens == 20
        assert response.usage.total_tokens == 30
        assert response.metadata["done_reason"] == "stop"

        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert args[0] == "http://test-ollama:11434/api/chat"
        payload = kwargs["json"]
        assert payload["model"] == "test-model"
        assert payload["messages"] == [
            {"role": "system", "content": "sys"},
            {"role": "user", "content": "usr"}
        ]
        assert payload["options"]["temperature"] == 0.5
        assert payload["options"]["num_predict"] == 100

def test_ollama_provider_missing_usage(provider, request_obj):
    with patch("httpx.Client.post") as mock_post:
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "message": {"content": "No usage"}
        }
        mock_post.return_value = mock_response

        response = provider.generate(request_obj)

        assert response.content == "No usage"
        assert response.usage.prompt_tokens == 0
        assert response.usage.completion_tokens == 0
        assert response.usage.total_tokens == 0

def test_ollama_provider_connection_error(provider, request_obj):
    with patch("httpx.Client.post", side_effect=httpx.ConnectError("Connection refused")):
        with pytest.raises(LLMProviderError, match="Failed to connect to Ollama"):
            provider.generate(request_obj)

def test_ollama_provider_timeout(provider, request_obj):
    with patch("httpx.Client.post", side_effect=httpx.TimeoutException("Timeout")):
        with pytest.raises(LLMProviderError, match="timed out"):
            provider.generate(request_obj)

def test_ollama_provider_http_status_error(provider, request_obj):
    mock_request = httpx.Request("POST", "http://test")
    mock_response = httpx.Response(500, request=mock_request)
    with patch("httpx.Client.post") as mock_post:
        mock_post.return_value.raise_for_status.side_effect = httpx.HTTPStatusError("500 Error", request=mock_request, response=mock_response)
        with pytest.raises(LLMProviderError, match="Ollama returned HTTP 500"):
            provider.generate(request_obj)

def test_ollama_provider_invalid_json_structure(provider, request_obj):
    with patch("httpx.Client.post") as mock_post:
        mock_response = MagicMock()
        mock_response.json.return_value = ["not", "a", "dict"]
        mock_post.return_value = mock_response

        with pytest.raises(LLMProviderError, match="invalid JSON structure"):
            provider.generate(request_obj)

def test_ollama_provider_missing_content(provider, request_obj):
    with patch("httpx.Client.post") as mock_post:
        mock_response = MagicMock()
        mock_response.json.return_value = {"message": {}}
        mock_post.return_value = mock_response

        with pytest.raises(LLMProviderError, match="missing 'message.content'"):
            provider.generate(request_obj)
