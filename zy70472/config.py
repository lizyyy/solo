from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    SIGNATURE_EXPIRE_MINUTES: int = 30
    AUDIT_DIR: str = "./audit_records"
    GRAY_SEARCH_THRESHOLD: float = 0.7

    class Config:
        env_file = ".env"


settings = Settings()
