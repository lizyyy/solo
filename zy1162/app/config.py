from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./red_packet.db"
    DEBUG: bool = True
    SECRET_KEY: str = "test-secret-key"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    MAX_RETRY_COUNT: int = 3
    RETRY_INTERVAL_SECONDS: int = 5

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
