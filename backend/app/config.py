"""Application settings loaded from environment variables."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for the backend service."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite:////data/analyses.db"
    secret_key: str = "change-me-in-production-use-long-random-string"
    algorithm: str = "HS256"
    access_token_expire_days: int = 1
    refresh_token_expire_days: int = 30
    root_path: str = "/extra/analyses"
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    cookie_path: str = "/extra/analyses"
    cors_origins: str = "http://localhost:8000,https://daystream.ru"
    log_file: str = "logs/app.log"
    backend_port: int = 8000

    @property
    def cors_origin_list(self) -> list[str]:
        """Parse CORS origins from a comma-separated string."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings."""
    return Settings()
