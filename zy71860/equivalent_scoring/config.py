import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
EXPORT_DIR = BASE_DIR / "exports"
HISTORY_DIR = BASE_DIR / "history"

DATA_DIR.mkdir(exist_ok=True)
EXPORT_DIR.mkdir(exist_ok=True)
HISTORY_DIR.mkdir(exist_ok=True)

DB_PATH = DATA_DIR / "scoring.db"
THRESHOLD = 0.85
EMPTY_SET_THRESHOLD = 0.95
