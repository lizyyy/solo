import os

DB_PATH = os.getenv("SUBSTITUTION_DB_PATH", "substitution.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))

APPROVAL_THRESHOLD = float(os.getenv("APPROVAL_THRESHOLD", "0.1"))
MAX_RETRY_TIMES = int(os.getenv("MAX_RETRY_TIMES", "3"))
EXPORT_DIR = os.getenv("EXPORT_DIR", "exports")
