from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./chemotherapy_tracker.db"
    API_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "化疗药批次追踪哨"
    VERSION: str = "1.0.0"
    DEBUG: bool = True

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
