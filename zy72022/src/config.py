import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR / "data"
SAMPLES_DIR = DATA_DIR / "samples"
EXPORTS_DIR = BASE_DIR / "exports"
LOGS_DIR = BASE_DIR / "logs"
DB_PATH = DATA_DIR / "auction_deposit.db"

DEPOSIT_KEYWORDS = [
    "二手车拍卖保证金",
    "拍卖保证金",
    "二手车保证金",
    "拍品保证金",
    "车辆拍卖保证金",
]

DEPOSIT_AMOUNT_THRESHOLD = 1000.0

BATCH_PATTERN = r"批次[_\-]?(\d+)|batch[_\-]?(\d+)"
TRANSACTION_NO_PATTERN = r"(TXN|TRAN|PAY|REF)\d{8,20}"

REQUIRED_EVIDENCE_FOR_CONFIRM = [
    "payment_flow",
    "approval_email",
]

DB_URL = f"sqlite:///{DB_PATH}"

for directory in [DATA_DIR, SAMPLES_DIR, EXPORTS_DIR, LOGS_DIR]:
    directory.mkdir(parents=True, exist_ok=True)
