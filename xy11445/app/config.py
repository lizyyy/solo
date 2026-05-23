from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./charging_pile_fsm.db"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    DEBUG: bool = True
    MAX_RETRY_COUNT: int = 3
    RETRY_INTERVAL_SECONDS: int = 60

    class Config:
        env_file = ".env"


settings = Settings()
