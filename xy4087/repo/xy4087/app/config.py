import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    PROJECT_NAME: str = "匿名指标保险箱"
    VERSION: str = "1.0.0"
    
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "sqlite:///./dp_vault.db"
    )
    
    DEFAULT_EPSILON: float = 1.0
    MIN_EPSILON: float = 0.1
    MAX_EPSILON: float = 10.0
    
    DEFAULT_DELTA: float = 1e-5
    
    SUPPRESSION_THRESHOLD: int = 5
    MIN_SUPPRESSION_THRESHOLD: int = 3
    MAX_SUPPRESSION_THRESHOLD: int = 50
    
    CACHE_TTL_SECONDS: int = 3600  # 1 hour
    MAX_CACHE_SIZE: int = 100
    
    UPLOAD_DIR: str = os.getenv(
        "UPLOAD_DIR", 
        "./uploads"
    )
    
    class Config:
        case_sensitive = True


settings = Settings()
