"""Application configuration via environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """App settings loaded from environment / .env file."""

    # Azure Blob Storage
    azure_storage_connection_string: str = ""
    azure_storage_container: str = "uploads"

    # Azure Cosmos DB
    azure_cosmos_connection_string: str = ""
    azure_cosmos_database: str = "embedbench"

    # Azure OpenAI
    azure_openai_endpoint: str = ""
    azure_openai_api_key: str = ""
    azure_openai_deployment: str = "gpt-4o-mini"

    # CORS
    cors_origins: list[str] = ["http://localhost:5173"]

    model_config = {"env_file": (".env", "../.env"), "extra": "ignore"}


settings = Settings()
