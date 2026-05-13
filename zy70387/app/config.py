import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./task_logs.db")
    DEFAULT_SAMPLE_RATE: float = float(os.getenv("DEFAULT_SAMPLE_RATE", "0.1"))
    DEFAULT_RETENTION_DAYS: int = int(os.getenv("DEFAULT_RETENTION_DAYS", "7"))
    FAILURE_CONTEXT_WINDOW: int = int(os.getenv("FAILURE_CONTEXT_WINDOW", "3"))
    
    class Config:
        env_file = ".env"


settings = Settings()
