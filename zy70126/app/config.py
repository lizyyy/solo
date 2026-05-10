from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "博物馆藏品出库审批系统"
    API_VERSION: str = "v1"
    DATABASE_URL: str = "sqlite:///./museum.db"
    
    RETRY_MAX_ATTEMPTS: int = 3
    RETRY_DELAY_SECONDS: int = 5
    TASK_TIMEOUT_SECONDS: int = 300
    
    class Config:
        env_file = ".env"


settings = Settings()
