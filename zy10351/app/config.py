from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "任务输出归档 API"
    
    DATABASE_URL: str = "sqlite:///./task_archive.db"
    
    SECRET_KEY: str = "your-secret-key-here-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    
    DEFAULT_ARCHIVE_DAYS: int = 90
    CLEANUP_BATCH_SIZE: int = 100
    
    class Config:
        case_sensitive = True


settings = Settings()
