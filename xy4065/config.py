from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
EXPORTS_DIR = BASE_DIR / "exports"
LOGS_DIR = BASE_DIR / "logs"
SAMPLE_DATA_DIR = BASE_DIR / "sample_data"

for dir_path in [DATA_DIR, EXPORTS_DIR, LOGS_DIR, SAMPLE_DATA_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)

COORDINATE_BOUNDS = {
    "min_lat": 30.0,
    "max_lat": 32.0,
    "min_lon": 118.0,
    "max_lon": 120.0
}

TIMEZONE = "Asia/Shanghai"

RULE_CONFIG = {
    "abnormal_sound_threshold": 3,
    "abnormal_sound_hours": 2,
    "water_radius_meters": 50,
    "recurrence_days": 7,
    "review_timeout_hours": 24,
    "duplicate_distance_meters": 10
}

MANHOLE_PREFIXES = {
    "sensor": ["MH-", "S-", "SS-"],
    "manual": ["井盖-", "井盖编号-", "JH-", "JG-"]
}

BLOCK_NAMES = {
    "central": "中心城区",
    "north": "北部新城",
    "east": "东部工业区",
    "south": "南部新区",
    "west": "西部开发区"
}

RISK_LEVELS = {
    "critical": {"name": "极高风险", "color": "#DC2626", "score": 90},
    "high": {"name": "高风险", "color": "#EA580C", "score": 70},
    "medium": {"name": "中风险", "color": "#CA8A04", "score": 50},
    "low": {"name": "低风险", "color": "#16A34A", "score": 30}
}
