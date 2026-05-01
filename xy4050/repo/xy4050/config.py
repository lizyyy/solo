import os
from pathlib import Path

APP_NAME = "应急演练观察合并台"
APP_VERSION = "1.0.0"

BASE_DIR = Path(__file__).parent.resolve()
DATA_DIR = BASE_DIR / "data"
SAMPLES_DIR = BASE_DIR / "samples"

DATABASE_PATH = DATA_DIR / "drills.db"

DEFAULT_TIME_FORMATS = [
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%H:%M:%S",
    "%H:%M",
    "%m-%d %H:%M:%S",
    "%m-%d %H:%M",
]

DUPLICATE_DETECTION_CONFIG = {
    "time_threshold_seconds": 30,
    "area_match_required": True,
    "event_type_match_required": True,
    "description_similarity_threshold": 0.7,
}

ISSUE_DETECTION_CONFIG = {
    "time_gap_warning_minutes": 5,
    "consecutive_high_risk_count": 2,
    "check_key_nodes": True,
}

EXPORT_CONFIG = {
    "default_encoding": "utf-8",
    "csv_delimiter": ",",
}

def ensure_data_dir():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
