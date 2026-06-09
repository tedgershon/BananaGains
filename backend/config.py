from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_key: str = ""
    # Service role key (backend only). Bypasses RLS for server-side inserts like notifications.
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    cors_origins: list[str] = ["http://localhost:3000"]

    sentry_dsn: str = ""
    sentry_environment: str = "development"
    sentry_release: str | None = None
    sentry_traces_sample_rate: float = 0.1

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
