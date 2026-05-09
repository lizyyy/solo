import os
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Any


@dataclass
class Config:
    BASE_DIR: str = os.path.dirname(os.path.abspath(__file__))
    BACKUPS_DIR: str = os.path.join(BASE_DIR, "backups")
    RECOVERIES_DIR: str = os.path.join(BASE_DIR, "recoveries")
    REPORTS_DIR: str = os.path.join(BASE_DIR, "reports")
    LOGS_DIR: str = os.path.join(BASE_DIR, "logs")
    TEMP_DIR: str = os.path.join(BASE_DIR, "temp")

    DB_HOST: str = os.environ.get("DB_HOST", "localhost")
    DB_PORT: int = int(os.environ.get("DB_PORT", 5432))
    DB_USER: str = os.environ.get("DB_USER", "postgres")
    DB_PASSWORD: str = os.environ.get("DB_PASSWORD", "postgres")
    DB_NAME: str = os.environ.get("DB_NAME", "testdb")

    MOCK_MODE: bool = True

    CRITICAL_TABLES: List[str] = field(
        default_factory=lambda: [
            "users",
            "orders",
            "products",
            "transactions",
            "audit_logs",
        ]
    )

    REQUIRED_PERMISSIONS: List[str] = field(
        default_factory=lambda: [
            "CREATE",
            "DROP",
            "INSERT",
            "SELECT",
            "UPDATE",
            "DELETE",
            "TRUNCATE",
            "REFERENCES",
            "TRIGGER",
        ]
    )

    TIMESTAMP_FORMAT: str = "%Y%m%d_%H%M%S"

    def ensure_dirs(self):
        for dir_path in [
            self.BACKUPS_DIR,
            self.RECOVERIES_DIR,
            self.REPORTS_DIR,
            self.LOGS_DIR,
            self.TEMP_DIR,
        ]:
            os.makedirs(dir_path, exist_ok=True)


config = Config()
