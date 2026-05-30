import os
from pathlib import Path

BASE_DIR = Path(__file__).parent

DATA_DIR = BASE_DIR / "data"
INPUT_DIR = DATA_DIR / "input"
OUTPUT_DIR = DATA_DIR / "output"
LOG_DIR = DATA_DIR / "logs"
RATE_DIR = DATA_DIR / "rates"

for dir_path in [DATA_DIR, INPUT_DIR, OUTPUT_DIR, LOG_DIR, RATE_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)

TRANSACTION_FILE = INPUT_DIR / "transactions.xlsx"
RATE_FILE = RATE_DIR / "rate_table.xlsx"
SETTLEMENT_LOG = LOG_DIR / "settlement_history.json"
RECONCILIATION_REPORT = OUTPUT_DIR / "reconciliation_report.txt"

REFUND_THRESHOLD_DAYS = 7
PENDING_AMOUNT_THRESHOLD = 100.0
