from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    APP_NAME: str = "封锁点冲突审签台"
    APP_VERSION: str = "1.0.0"
    DATABASE_URL: str = "sqlite:///./blockade_check.db"
    UPLOAD_DIR: str = "./uploads"
    EXPORT_DIR: str = "./exports"
    DEBUG: bool = True
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()

# 确保必要的目录存在
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.EXPORT_DIR, exist_ok=True)
