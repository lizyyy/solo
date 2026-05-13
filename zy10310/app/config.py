from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./tenant_import.db"
    SECRET_KEY: str = "tenant-import-precheck-secret-key-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    API_VERSION: str = "v1"
    RULES_VERSION: str = "1.0.0"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings():
    return Settings()
