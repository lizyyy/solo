from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    PROJECT_NAME: str = "Warehouse Robot Scheduler"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "sqlite:///./warehouse_scheduler.db"
    )
    
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")
    DATA_DIR: str = os.getenv("DATA_DIR", "./data")
    
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    
    class Config:
        case_sensitive = True
        env_file = ".env"


settings = Settings()
