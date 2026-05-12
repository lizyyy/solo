import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR / "data"
STORAGE_DIR = BASE_DIR / "storage_data"
SAMPLES_DIR = BASE_DIR / "samples"

DEFINITIONS_FILE = DATA_DIR / "task_definitions.yaml"
DEFAULT_RUN_DATE = "2026-05-12"

def ensure_dirs():
    for d in [DATA_DIR, STORAGE_DIR, SAMPLES_DIR]:
        os.makedirs(d, exist_ok=True)
