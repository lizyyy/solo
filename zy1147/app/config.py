import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "Sensitive Content Audit Service"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    DATA_DIR: Path = BASE_DIR / "data"
    DB_PATH: Path = DATA_DIR / "audit.db"
    SEED_DIR: Path = DATA_DIR / "seed"
    REPORTS_DIR: Path = DATA_DIR / "reports"
    
    DATABASE_URL: str = f"sqlite+aiosqlite:///{DB_PATH}"
    
    JIEBA_USER_DICT: Optional[Path] = None
    
    SENSITIVE_CATEGORIES: list = [
        "political",
        "violent",
        "pornographic",
        "gambling",
        "fraud",
        "abusive",
        "discriminatory",
        "terrorist",
        "drug",
        "other"
    ]
    
    SEVERITY_LEVELS: list = ["low", "medium", "high", "critical"]
    
    DEFAULT_SEVERITY: str = "medium"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

os.makedirs(settings.DATA_DIR, exist_ok=True)
os.makedirs(settings.SEED_DIR, exist_ok=True)
os.makedirs(settings.REPORTS_DIR, exist_ok=True)
