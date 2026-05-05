from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "Redis Cluster Drill Platform"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    DATABASE_URL: str = "sqlite:///./redis_drill.db"
    
    DATA_DIR: str = "./data"
    UPLOAD_DIR: str = "./uploads"
    REPORTS_DIR: str = "./reports"
    
    MAX_SLOTS: int = 16384
    DEFAULT_SEED: int = 42
    
    class Config:
        env_file = ".env"


settings = Settings()
