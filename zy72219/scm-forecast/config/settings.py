import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent

DATA_DIR = BASE_DIR / "data"
SAMPLES_DIR = DATA_DIR / "samples"
INPUT_DIR = DATA_DIR / "input"
OUTPUT_DIR = DATA_DIR / "output"

SETTLEMENT_CYCLE_NORMAL = "T+1"
SETTLEMENT_CYCLE_MODIFIED = "T+2"

HOLIDAY_CALENDAR = {
    "2026-05-01": "劳动节",
    "2026-05-02": "劳动节调休",
    "2026-05-03": "劳动节调休",
    "2026-06-01": "端午节",
    "2026-06-02": "端午节调休",
    "2026-10-01": "国庆节",
    "2026-10-02": "国庆节",
    "2026-10-03": "国庆节",
    "2026-10-04": "国庆节调休",
    "2026-10-05": "国庆节调休",
    "2026-10-06": "国庆节调休",
    "2026-10-07": "国庆节调休",
}

WORKFLOW_STEPS = [
    "import_settlement_batch",
    "review_holiday_deferral",
    "update_reconciliation",
]

REQUIRED_CHECKS = [
    "duplicate_import",
    "t1_to_t2_modification",
    "supplement_recalculation",
    "export_consistency",
]
