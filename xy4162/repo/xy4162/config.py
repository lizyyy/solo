import os
from datetime import timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATA_DIR = os.path.join(BASE_DIR, "data")
SAMPLE_DIR = os.path.join(DATA_DIR, "sample")
INPUT_DIR = os.path.join(DATA_DIR, "input")
OUTPUT_DIR = os.path.join(DATA_DIR, "output")
STORAGE_DIR = os.path.join(DATA_DIR, "storage")

for dir_path in [DATA_DIR, SAMPLE_DIR, INPUT_DIR, OUTPUT_DIR, STORAGE_DIR]:
    os.makedirs(dir_path, exist_ok=True)

CLEANING_INTERVAL_HOURS = 4
CLEANING_GRACE_MINUTES = 30

LATE_CLEANING_THRESHOLD_HOURS = 6
BACKFILL_SUSPECT_MINUTES = 120

HIGH_VOLUME_THRESHOLD = 50
ABNORMAL_VOLUME_RATIO = 0.3

WORKORDER_STATUS_OPEN = "open"
WORKORDER_STATUS_IN_PROGRESS = "in_progress"
WORKORDER_STATUS_CLOSED = "closed"

DATE_FORMAT = "%Y-%m-%d %H:%M:%S"
DATE_FORMAT_SHORT = "%Y-%m-%d"

STORES = ["中关村店", "国贸店", "望京店", "三里屯店", "大悦城店"]
MACHINES_PER_STORE = 2

RISK_LEVELS = {
    "critical": "严重",
    "high": "高",
    "medium": "中",
    "low": "低"
}

REVIEW_STATUS = {
    "pending": "待复核",
    "confirmed": "已确认风险",
    "dismissed": "已排除风险",
    "escalated": "已升级处理"
}
