"""Chat endpoint."""

from fastapi import APIRouter, Depends
from openai import AzureOpenAI
from pydantic import BaseModel

from src.config import Settings, get_settings
from src.openai_client import get_openai_client

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str


@router.post("/", response_model=ChatResponse)
def chat(
    req: ChatRequest,
    settings: Settings = Depends(get_settings),
    client: AzureOpenAI = Depends(get_openai_client),
) -> ChatResponse:
    result = client.chat.completions.create(
        model=settings.azure_openai_deployment,
        messages=[{"role": "user", "content": req.message}],
        max_tokens=512,
    )
    reply = result.choices[0].message.content or ""
    return ChatResponse(reply=reply)
