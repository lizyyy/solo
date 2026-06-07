from pathlib import Path

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
SNAPSHOT_DIR = DATA_DIR / "snapshots"
TRAINING_LOG_DIR = DATA_DIR / "training_logs"
DROPOUT_RECORDS_DIR = DATA_DIR / "dropout_records"
HISTORY_DIR = DATA_DIR / "history"

TIME_WINDOW_HOURS = 24
MAX_DROPOUT_THRESHOLD = 0.3

REVIEW_REQUIRED_STATUSES = {"time_window_crossed", "suspicious_pattern"}

for d in [DATA_DIR, SNAPSHOT_DIR, TRAINING_LOG_DIR, DROPOUT_RECORDS_DIR, HISTORY_DIR]:
    d.mkdir(parents=True, exist_ok=True)
