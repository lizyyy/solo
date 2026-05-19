import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./pharmacy.db"
    DEBUG: bool = True
    MAX_BATCH_SIZE: int = 100
    RETRY_TIMES: int = 3

    class Config:
        env_file = ".env"


settings = Settings()
