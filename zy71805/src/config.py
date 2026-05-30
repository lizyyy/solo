import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent

DATA_DIR = BASE_DIR / "data"
INPUT_DIR = DATA_DIR / "input"
OUTPUT_DIR = DATA_DIR / "output"
HISTORY_DIR = DATA_DIR / "history"
REPORTS_DIR = BASE_DIR / "reports"
STATIC_DIR = BASE_DIR / "static"

for dir_path in [DATA_DIR, INPUT_DIR, OUTPUT_DIR, HISTORY_DIR, REPORTS_DIR, STATIC_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)

MARGIN_RATE = 0.15
RISK_FREE_RATE = 0.03

REVIEW_STATUS = {
    "CONFIRMED": "已确认",
    "PENDING": "待补",
    "MANUAL": "人工修改"
}

SOURCE_TYPE = {
    "CREDIT_LEDGER": "授信台账",
    "TRADE_FLOW": "交易流水",
    "MANUAL": "人工备注"
}
