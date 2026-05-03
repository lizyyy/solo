import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SAMPLES_DIR = os.path.join(BASE_DIR, "samples")
DATA_DIR = os.path.join(BASE_DIR, "data")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")

TIMEZONES = {
    "UTC": 0,
    "EST": -5,
    "CST": -6,
    "PST": -8,
    "GMT": 0,
    "CET": 1,
    "EET": 2,
    "CST_CHINA": 8,
    "JST": 9,
    "AEST": 10,
}

RISK_LEVELS = {
    "CRITICAL": "严重",
    "HIGH": "高",
    "MEDIUM": "中",
    "LOW": "低",
}

RISK_TYPES = {
    "ZONE_VIOLATION": "海区违规排放",
    "VOLUME_EXCEEDED": "排放量超标",
    "SENSOR_GAP": "传感器断采",
    "MANUAL_CONFLICT": "人工记录冲突",
    "PUMP_STATUS_CONFLICT": "泵阀状态冲突",
    "MISSING_SENSOR": "缺失传感器数据",
    "TIMEZONE_ISSUE": "跨时区问题",
}

BALLAST_TANKS = [f"BW-{i:02d}" for i in range(1, 13)] + \
                 [f"BW-P{i:02d}" for i in range(1, 5)] + \
                 [f"FW-{i:02d}" for i in range(1, 3)]

for dir_path in [SAMPLES_DIR, DATA_DIR, OUTPUT_DIR]:
    os.makedirs(dir_path, exist_ok=True)
