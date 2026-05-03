import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

DATA_DIR = BASE_DIR / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
SAMPLE_DATA_DIR = DATA_DIR / "sample"
SESSION_DIR = BASE_DIR / "sessions"
EXPORT_DIR = BASE_DIR / "exports"

for dir_path in [RAW_DATA_DIR, PROCESSED_DATA_DIR, SAMPLE_DATA_DIR, SESSION_DIR, EXPORT_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)

TIME_CONFIG = {
    "night_start_hour": 22,
    "night_end_hour": 6,
    "peak_hours": [18, 19, 20, 21, 22, 23, 0, 1],
    "time_slots": {
        "early_morning": (6, 9),
        "morning": (9, 12),
        "afternoon": (12, 18),
        "evening": (18, 22),
        "night": (22, 6)
    }
}

NOISE_THRESHOLDS = {
    "residential_night": 55,
    "residential_day": 60,
    "commercial_night": 60,
    "commercial_day": 65,
    "industrial_night": 65,
    "industrial_day": 70
}

NOISE_SOURCE_RULES = {
    "short_construction": {
        "keywords": ["施工", "装修", "打孔", "砸墙", "电钻"],
        "time_pattern": "irregular",
        "duration_min": 5,
        "duration_max": 120,
        "db_range": (70, 95),
        "description": "短时施工/装修活动"
    },
    "bar_closing": {
        "keywords": ["酒吧", "KTV", "夜店", "会所", "唱歌", "音乐"],
        "time_pattern": "night_peak",
        "peak_hours": [23, 0, 1, 2],
        "db_range": (65, 85),
        "description": "酒吧散场/夜间娱乐活动"
    },
    "road_construction": {
        "keywords": ["道路", "修路", "沥青", "铺路", "挖掘", "土方"],
        "time_pattern": "continuous",
        "duration_min": 180,
        "db_range": (75, 100),
        "description": "道路施工/大型工程"
    },
    "traffic": {
        "keywords": ["车辆", "堵车", "鸣笛", "货车", "卡车"],
        "time_pattern": "rush_hour",
        "rush_hours": [7, 8, 9, 17, 18, 19],
        "db_range": (60, 80),
        "description": "交通噪声"
    },
    "unknown": {
        "description": "未知噪声源"
    }
}

VISUALIZATION_CONFIG = {
    "color_scale": "Viridis",
    "map_center": {"lat": 39.9042, "lon": 116.4074},
    "default_zoom": 12
}

EXPORT_CONFIG = {
    "markdown_template": "report_template.md",
    "csv_encoding": "utf-8-sig",
    "json_indent": 2
}
