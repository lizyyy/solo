import os
from pathlib import Path

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "output"
LOG_DIR = BASE_DIR / "logs"

DRIFT_THRESHOLD = 0.05
ALLOWED_UNITS = ["件", "箱", "托", "kg", "吨"]

STANDARD_CONSTRAINTS = {
    "max_pick_per_order": 50,
    "min_pick_per_order": 1,
    "max_weight_per_trip": 1000,
}

for directory in [DATA_DIR, OUTPUT_DIR, LOG_DIR]:
    directory.mkdir(exist_ok=True)
