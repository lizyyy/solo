from pydantic_settings import BaseSettings
from typing import Optional
from pathlib import Path


class Settings(BaseSettings):
    APP_NAME: str = "DB Performance Diagnostics API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    DATABASE_URL: str = "sqlite:///./db_diagnostics.db"
    
    UPLOAD_DIR: str = "./uploads"
    EXPORT_DIR: str = "./exports"
    
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024  # 50MB
    
    SECRET_KEY: str = "your-secret-key-change-in-production"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()


def ensure_directories():
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.EXPORT_DIR).mkdir(parents=True, exist_ok=True)
