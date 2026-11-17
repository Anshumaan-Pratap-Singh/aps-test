from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="APS_", env_file=".env", extra="ignore")

    env: str = "development"
    database_url: str = "postgresql+asyncpg://aps:aps@localhost:5432/aps"
    redis_url: str | None = "redis://localhost:6379/0"
    # Must be overridden in production; startup refuses the default outside development.
    jwt_secret: str = Field(default="dev-insecure-secret-change-me-0123456789", min_length=32)
    jwt_ttl_minutes: int = 60 * 24 * 7
    cookie_secure: bool = False
    cors_origins: list[str] = ["http://localhost:3000"]
    rate_limit_per_minute: int = 240
    auth_rate_limit_per_minute: int = 10
    min_cohort_size: int = 30


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.env != "development" and s.env != "test" and s.jwt_secret.startswith("dev-insecure"):
        raise RuntimeError("APS_JWT_SECRET must be set outside development")
    return s
