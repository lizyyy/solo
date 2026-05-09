import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "设备能效基线管理系统"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "sqlite:///./energy_efficiency.db"
    )
    
    REDIS_URL: str = os.getenv(
        "REDIS_URL", 
        "redis://localhost:6379/0"
    )
    
    CELERY_BROKER_URL: str = os.getenv(
        "CELERY_BROKER_URL", 
        "redis://localhost:6379/0"
    )
    
    CELERY_RESULT_BACKEND: str = os.getenv(
        "CELERY_RESULT_BACKEND", 
        "redis://localhost:6379/0"
    )
    
    MAX_RETRY_ATTEMPTS: int = 3
    RETRY_DELAY_SECONDS: int = 60
    
    OUTLIER_THRESHOLD: float = 3.0
    MIN_DATA_POINTS: int = 10
    
    EXPORT_DIR: str = "./exports"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
