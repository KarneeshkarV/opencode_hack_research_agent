from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[4]
API_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(ROOT_DIR / ".env", API_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "OpenCode Hack Research Agent"
    model_id: str = Field(
        default="gpt-5.2",
        validation_alias=AliasChoices("MODEL_ID", "AGNO_MODEL_ID"),
    )
    financial_datasets_api_key: str | None = None
    kite_api_key: str | None = None
    kite_api_secret: str | None = None
    kite_access_token: str | None = None
    kite_dry_run: bool = True
    exa_api_key: str | None = None
    openai_api_key: str | None = None
    external_tool_timeout_seconds: int = 25

    langfuse_public_key: str | None = None
    langfuse_secret_key: str | None = None
    langfuse_host: str = Field(
        default="https://us.cloud.langfuse.com",
        validation_alias=AliasChoices("LANGFUSE_HOST", "LANGFUSE_BASE_URL"),
    )
    langfuse_enabled: bool = True
    service_name: str = "research-agent-api"
    service_version: str = "0.1.0"
    environment: str = "dev"


@lru_cache
def get_settings() -> Settings:
    return Settings()
