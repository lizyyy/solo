from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./api_validator.db"
    VALIDATION_TIMEOUT: int = 30
    MAX_RETRIES: int = 3
    SCHEDULED_VALIDATION_ENABLED: bool = True
    SCHEDULED_VALIDATION_CRON: str = "0 0 * * *"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings():
    return Settings()
