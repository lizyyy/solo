import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "机场地勤寒潮航班放行系统"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./deice_release.db"
    )
    
    DATA_DIR: str = os.getenv("DATA_DIR", "./data")
    EXPORT_DIR: str = os.getenv("EXPORT_DIR", "./exports")
    
    MIN_DEICE_CONCENTRATION: float = 0.5
    MAX_DEICE_CONCENTRATION: float = 0.8
    DEFAULT_HOLD_TIME_MINUTES: int = 30
    MAX_GATE_CONFLICT_MINUTES: int = 15
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

os.makedirs(settings.DATA_DIR, exist_ok=True)
os.makedirs(settings.EXPORT_DIR, exist_ok=True)
