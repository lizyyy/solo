from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
EXPORT_DIR = BASE_DIR / "exports"
STATE_DIR = BASE_DIR / "states"

DATA_DIR.mkdir(exist_ok=True)
EXPORT_DIR.mkdir(exist_ok=True)
STATE_DIR.mkdir(exist_ok=True)

RULE_CONFIG = {
    "mild_max_ratio": 0.05,
    "moderate_max_ratio": 0.15,
    "severe_max_ratio": 0.30,
    "color_brown_weight": 0.7,
    "color_yellow_weight": 0.5,
    "color_normal_weight": 0.2,
    "color_weight": 0.3,
    "area_weight": 0.7,
}

COLOR_CATEGORIES = {
    "褐色": {"range": (0, 0.4), "weight": 0.7},
    "黄褐色": {"range": (0.4, 0.7), "weight": 0.5},
    "黄色": {"range": (0.7, 1.0), "weight": 0.3},
    "浅褐色": {"range": (0.2, 0.5), "weight": 0.6},
    "枯黄": {"range": (0.8, 1.0), "weight": 0.4},
}
