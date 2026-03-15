"""Chat API endpoints for Azure OpenAI connectivity checks."""

from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from openai import APIConnectionError, APIError, AuthenticationError, AzureOpenAI, NotFoundError
from pydantic import BaseModel, Field, field_validator

from src.config import settings

router = APIRouter(prefix="/chat", tags=["chat"])
MAX_CHAT_TOKENS = 512


class ChatRequest(BaseModel):
    """Request payload for connectivity-check chat endpoint."""

    prompt: str = Field(description="User prompt text sent to Azure OpenAI")

    @field_validator("prompt")
    @classmethod
    def validate_prompt(cls, value: str) -> str:
        """Ensure prompt contains at least one non-whitespace character."""
        if not value.strip():
            raise ValueError("prompt must not be empty")
        return value


class ChatResponse(BaseModel):
    """Response payload returned by chat endpoint."""

    reply: str
    model: str
    usage: dict[str, int] | None = None


def _create_openai_client() -> AzureOpenAI:
    """Build an Azure OpenAI client from app settings."""
    missing_settings: list[str] = []

    if not settings.azure_openai_endpoint:
        missing_settings.append("AZURE_OPENAI_ENDPOINT")
    if not settings.azure_openai_api_key:
        missing_settings.append("AZURE_OPENAI_API_KEY")
    if not settings.azure_openai_deployment:
        missing_settings.append("AZURE_OPENAI_DEPLOYMENT")

    if missing_settings:
        missing_str = ", ".join(missing_settings)
        raise HTTPException(status_code=500, detail=f"Missing Azure OpenAI configuration: {missing_str}")

    return AzureOpenAI(
        azure_endpoint=settings.azure_openai_endpoint,
        api_key=settings.azure_openai_api_key,
        api_version="2024-12-01-preview",
    )


@router.post("/", response_model=ChatResponse)
async def chat_endpoint(payload: ChatRequest) -> ChatResponse:
    """Send a simple prompt to Azure OpenAI to validate end-to-end connectivity."""
    client = _create_openai_client()

    try:
        response = client.chat.completions.create(
            model=settings.azure_openai_deployment,
            messages=[{"role": "user", "content": payload.prompt}],
            max_tokens=MAX_CHAT_TOKENS,
        )
    except (AuthenticationError, NotFoundError) as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Azure OpenAI authentication or deployment failed. "
                "Verify endpoint, API key, and deployment name."
            ),
        ) from exc
    except (APIConnectionError, APIError) as exc:
        raise HTTPException(
            status_code=502,
            detail="Azure OpenAI request failed due to connectivity or service issues.",
        ) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Unexpected error while calling Azure OpenAI.") from exc

    reply = ""
    if response.choices:
        reply = (response.choices[0].message.content or "").strip()

    usage_info: dict[str, int] | None = None
    if response.usage is not None:
        usage_info = {
            "prompt_tokens": response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
            "total_tokens": response.usage.total_tokens,
        }

    model_name = response.model or settings.azure_openai_deployment
    return ChatResponse(reply=reply, model=model_name, usage=usage_info)


CHAT_TEST_PAGE = """<!doctype html>
<html lang=\"en\">
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>EmbedBench Chat Connectivity Test</title>
    <style>
      body { font-family: sans-serif; margin: 2rem; max-width: 900px; }
      textarea { width: 100%; min-height: 160px; margin-top: 0.5rem; }
      button { margin-top: 0.75rem; padding: 0.6rem 1rem; }
      pre { margin-top: 1rem; background: #f6f8fa; padding: 1rem; overflow-x: auto; }
    </style>
  </head>
  <body>
    <h1>Azure OpenAI Chat Test</h1>
    <p>Use this page to verify backend -> Azure OpenAI connectivity.</p>

    <label for=\"prompt\">Prompt</label>
    <textarea id=\"prompt\" placeholder=\"Type a short prompt...\">Say 'connection ok'.</textarea>
    <br />
    <button id=\"send\" type=\"button\">Send</button>

    <pre id=\"output\">Response will appear here...</pre>

    <script>
      const output = document.getElementById("output");
      const sendBtn = document.getElementById("send");
      const promptInput = document.getElementById("prompt");

      sendBtn.addEventListener("click", async () => {
        output.textContent = "Sending request...";

        try {
          const response = await fetch("/chat/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: promptInput.value })
          });

          const data = await response.json();
          output.textContent = JSON.stringify(data, null, 2);
        } catch (error) {
          output.textContent = `Request failed: ${error}`;
        }
      });
    </script>
  </body>
</html>
"""


@router.get("/test", response_class=HTMLResponse)
async def chat_test_page() -> HTMLResponse:
    """Serve a minimal page for manual chat endpoint verification."""
    return HTMLResponse(content=CHAT_TEST_PAGE)
