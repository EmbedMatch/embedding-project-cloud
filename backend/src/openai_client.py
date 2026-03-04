"""Azure OpenAI client as a FastAPI dependency."""

from openai import AzureOpenAI

from src.config import get_settings


def get_openai_client() -> AzureOpenAI:
    settings = get_settings()
    return AzureOpenAI(
        azure_endpoint=settings.azure_openai_endpoint,
        api_key=settings.azure_openai_api_key,
        api_version="2024-12-01-preview",
    )
