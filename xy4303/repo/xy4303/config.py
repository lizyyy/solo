import os
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

DATA_DIR = BASE_DIR / "data"
SAMPLE_DATA_DIR = BASE_DIR / "sample_data"
OUTPUT_DIR = BASE_DIR / "output"
BACKUP_DIR = BASE_DIR / "backups"

STORAGE_FILE = DATA_DIR / "workbench_state.json"
HISTORY_FILE = DATA_DIR / "history.json"

MAX_HISTORY_SIZE = 50

CHECK_CONFIG = {
    "photo_time_threshold_hours": 48,
    "overdue_days": 3,
    "rework_max_count": 3,
    "required_photos": ["咬合关系", "模型正面", "模型侧面", "模型咬合面"],
}

STATUS_FLOW = {
    "待接收": ["已接收"],
    "已接收": ["加工中", "待返工"],
    "加工中": ["待检验", "待返工"],
    "待检验": ["已完成", "待返工"],
    "待返工": ["返工中"],
    "返工中": ["加工中", "已完成"],
    "已完成": [],
}

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff"}
ALLOWED_STL_EXTENSIONS = {".stl", ".obj"}
ALLOWED_CSV_EXTENSIONS = {".csv", ".xlsx", ".xls"}

for directory in [DATA_DIR, SAMPLE_DATA_DIR, OUTPUT_DIR, BACKUP_DIR]:
    directory.mkdir(parents=True, exist_ok=True)
