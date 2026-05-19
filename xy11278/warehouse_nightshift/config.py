import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "warehouse_nightshift.db"
EXPORT_DIR = DATA_DIR / "exports"
IMPORT_DIR = DATA_DIR / "imports"

for directory in [DATA_DIR, EXPORT_DIR, IMPORT_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

SHIFT_HOURS = {
    "night": {"start": 22, "end": 6},
    "day": {"start": 6, "end": 22}
}

MIN_BATTERY_FOR_TASK = 30
CHARGING_TIME_PER_10_PERCENT = 30
