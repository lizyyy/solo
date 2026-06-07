from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
RESULT_DIR = BASE_DIR / "results"

DATA_DIR.mkdir(exist_ok=True)
RESULT_DIR.mkdir(exist_ok=True)

REVIEWER_A_YUE = "阿越"
DATA_SCIENTIST = "数据科学家"

DEFAULT_THRESHOLD = 0.5

SELF_CHECK_ITEMS = [
    "duplicate_import",
    "threshold_report_mismatch",
    "recalc_after_supplement",
    "export_consistency",
]
