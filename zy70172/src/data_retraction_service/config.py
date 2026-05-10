import os
from pathlib import Path


class Config:
    BASE_DIR = Path(__file__).parent.parent.parent
    DATA_DIR = BASE_DIR / "data"
    DB_PATH = DATA_DIR / "retraction_service.db"
    
    DATABASE_URL = os.environ.get(
        "DATABASE_URL",
        f"sqlite:///{DB_PATH}"
    )
    
    DEFAULT_RULESET = "standard_v1"
    MAX_RETRIES = 3
    
    @classmethod
    def ensure_dirs(cls):
        cls.DATA_DIR.mkdir(parents=True, exist_ok=True)
