from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "sqlite:///./gray_verification.db"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    env: str = "development"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings():
    return Settings()
