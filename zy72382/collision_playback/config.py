import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
PHOTO_DIR = DATA_DIR / "photos"
DB_PATH = DATA_DIR / "collision.db"

DB_PATH.parent.mkdir(parents=True, exist_ok=True)
PHOTO_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

RECORD_STATUS = {
    "NORMAL": "normal",
    "PENDING_REVIEW": "pending_review",
    "REVIEWED": "reviewed",
}

PLAYBACK_SOURCE = {
    "ORIGINAL": "original",
    "MANUAL_CORRECTION": "manual_correction",
    "PHOTO_SUPPLEMENT": "photo_supplement",
}

OPERATOR_LAOCEN = "老岑"
OPERATOR_ENGINEER = "设备工程师"
