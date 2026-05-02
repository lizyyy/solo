from pathlib import Path
from typing import Dict, List

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "output"
SAVED_PLANS_DIR = BASE_DIR / "saved_plans"

RISK_CONFIG = {
    "HEAT_THRESHOLD": 35.0,
    "CRITICAL_HEAT_THRESHOLD": 38.0,
    "WALKING_TIME_THRESHOLD": 15,
    "BUS_TIME_THRESHOLD": 30,
    "AGE_HIGH_RISK": 75,
    "AGE_CRITICAL": 85,
}

WEIGHTS_CONFIG = {
    "age": 0.25,
    "health": 0.25,
    "living_alone": 0.15,
    "mobility": 0.15,
    "heat_exposure": 0.20,
}

TIME_SLOTS = [f"{h:02d}:00" for h in range(6, 22)]

PAGE_CONFIG = {
    "page_title": "高温避暑站调度沙盘",
    "page_icon": "🌡️",
    "layout": "wide",
    "initial_sidebar_state": "expanded",
}

for dir_path in [DATA_DIR, OUTPUT_DIR, SAVED_PLANS_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)
