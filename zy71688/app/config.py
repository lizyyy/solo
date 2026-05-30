import os

DATABASE_URL = os.getenv("APPEAL_DB_URL", "sqlite:///./appeal_ledger.db")
EXPORT_DIR = os.getenv("APPEAL_EXPORT_DIR", "./exports")
