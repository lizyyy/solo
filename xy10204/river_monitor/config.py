"""配置文件 - 定义分析参数和计算口径"""

DEFAULT_TIME_FORMAT = "%Y-%m-%d %H:%M:%S"
DEFAULT_SAMPLE_INTERVAL = 60  # 分钟
DEFAULT_HISTORY_DIR = "./history"
DEFAULT_REPORT_DIR = "./reports"
DEFAULT_DATA_DIR = "./data"

ANOMALY_THRESHOLDS = {
    "water_level_spike": 0.3,  # 水位突涨阈值（米/小时）
    "water_level_drop": 0.2,   # 水位突降阈值（米/小时）
    "rainfall_spike": 10.0,    # 雨量突增阈值（毫米/小时）
    "gate_opening_change": 0.5,  # 闸门开度突变阈值（米/小时）
}

MIN_VALID_VALUES = {
    "water_level": (0, 50),   # 水位有效范围（米）
    "rainfall": (0, 1000),    # 雨量有效范围（毫米）
    "gate_opening": (0, 10),  # 闸门开度有效范围（米）
}

DATA_COLUMNS = {
    "water_level": ["timestamp", "station_id", "water_level_m", "inspector_id"],
    "rainfall": ["timestamp", "station_id", "rainfall_mm", "inspector_id"],
    "gate_opening": ["timestamp", "station_id", "gate_opening_m", "inspector_id"],
}
