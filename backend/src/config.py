"""Application configuration loaded from environment variables."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Look for .env in backend/ then project root (../), so both `uv run` and Docker work
_ENV_FILES = (Path(__file__).parent.parent / ".env", Path(__file__).parent.parent.parent / ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILES,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Azure Blob Storage
    azure_storage_connection_string: str
    azure_storage_container: str = "uploads"

    # Azure Cosmos DB
    azure_cosmos_connection_string: str
    azure_cosmos_database: str = "embedbench"

    # Azure OpenAI
    azure_openai_endpoint: str
    azure_openai_api_key: str
    azure_openai_deployment: str = "gpt-35-turbo"

    # CORS
    cors_origins: list[str] = ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
