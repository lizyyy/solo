import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
EXPORT_DIR = DATA_DIR / "exports"
DB_PATH = DATA_DIR / "bill_reminder.db"

DATA_DIR.mkdir(exist_ok=True)
UPLOAD_DIR.mkdir(exist_ok=True)
EXPORT_DIR.mkdir(exist_ok=True)

DATABASE_URL = f"sqlite:///{DB_PATH}"

STATUS_NORMAL = "normal"
STATUS_PENDING = "pending"
STATUS_CONFIRMED = "confirmed"
STATUS_REVISED = "revised"
STATUS_DISPUTED = "disputed"

ANOMALY_DUPLICATE = "duplicate"
ANOMALY_CROSS_PERIOD = "cross_period"
ANOMALY_SUSPENSE = "suspense"
ANOMALY_REFUND = "refund"
ANOMALY_FEE_MISMATCH = "fee_mismatch"

BILL_TYPE_INVOICE = "invoice"
BILL_TYPE_STATEMENT = "statement"
BILL_TYPE_SETTLEMENT = "settlement"
