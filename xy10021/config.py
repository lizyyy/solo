from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "日志分析系统"
    DATABASE_URL: str = "sqlite:///./log_analyzer.db"
    API_PREFIX: str = "/api"
    
    TASK_MAX_RETRIES: int = 3
    TASK_RETRY_DELAY: int = 5
    
    IDEMPOTENCY_EXPIRE_HOURS: int = 24
    
    SCHEDULER_ENABLED: bool = True
    
    class Config:
        env_file = ".env"


settings = Settings()
