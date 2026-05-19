import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/exhibition_material.db")

class Config:
    DATABASE_URL = DATABASE_URL
    UPLOAD_DIR = BASE_DIR / "uploads"
    EXPORT_DIR = BASE_DIR / "exports"
    ERROR_DIR = BASE_DIR / "errors"
    
    @classmethod
    def ensure_dirs(cls):
        for dir_path in [cls.UPLOAD_DIR, cls.EXPORT_DIR, cls.ERROR_DIR]:
            dir_path.mkdir(parents=True, exist_ok=True)
