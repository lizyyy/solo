from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./data/visitor_system.db"
    UPLOAD_DIR: str = "./data/uploads"
    EXPORT_DIR: str = "./data/exports"
    LOG_DIR: str = "./logs"
    MAX_RETRY_TIMES: int = 3
    RETRY_INTERVAL: int = 60
    DEBUG: bool = True
    SECRET_KEY: str = "visitor-state-machine-secret-key-2024"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
