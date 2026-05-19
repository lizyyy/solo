import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
DATABASE_URL = f"sqlite:///{BASE_DIR / 'fire_maintenance.db'}"

os.makedirs(UPLOAD_DIR, exist_ok=True)
