import os
from pathlib import Path


class Config:
    BASE_DIR = Path.home() / ".fee_penetrate"
    DB_PATH = BASE_DIR / "fee_penetrate.db"
    EXPORT_DIR = BASE_DIR / "exports"
    ATTACHMENT_DIR = BASE_DIR / "attachments"

    @classmethod
    def init_dirs(cls):
        cls.BASE_DIR.mkdir(parents=True, exist_ok=True)
        cls.EXPORT_DIR.mkdir(parents=True, exist_ok=True)
        cls.ATTACHMENT_DIR.mkdir(parents=True, exist_ok=True)

    @classmethod
    def get_db_url(cls) -> str:
        return f"sqlite:///{cls.DB_PATH}"

    @classmethod
    def set_db_path(cls, path: str):
        cls.DB_PATH = Path(path)
        cls.BASE_DIR = cls.DB_PATH.parent
        cls.EXPORT_DIR = cls.BASE_DIR / "exports"
        cls.ATTACHMENT_DIR = cls.BASE_DIR / "attachments"
        cls.init_dirs()
