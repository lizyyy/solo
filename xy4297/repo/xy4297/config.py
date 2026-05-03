"""
冷链交接工具配置文件
"""

import os
from pathlib import Path
from typing import List, Dict, Any, Optional


class Config:
    BASE_DIR = Path(__file__).resolve().parent

    INPUT_DIR = BASE_DIR / "data" / "input"
    OUTPUT_DIR = BASE_DIR / "data" / "output"
    ARCHIVE_DIR = BASE_DIR / "data" / "archive"

    TEMP_THRESHOLD_MIN = 2.0
    TEMP_THRESHOLD_MAX = 8.0

    HOURS_BEFORE_EXPECTED = 24
    HOURS_AFTER_EXPECTED = 24

    REQUIRED_PHOTOS_PER_SHIFT = {
        "morning": ["temperature_1", "temperature_2", "door_check"],
        "evening": ["temperature_1", "temperature_2", "door_check", "inventory"],
    }

    SHIFT_TIMES = {
        "morning": {
            "start": "08:00",
            "end": "16:00",
            "handover_window": ("07:30", "08:30"),
        },
        "evening": {
            "start": "16:00",
            "end": "23:59",
            "handover_window": ("15:30", "16:30"),
        },
    }

    CSV_DATE_FORMATS = [
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%Y-%m-%dT%H:%M:%S",
    ]

    PHOTO_DATE_PATTERNS = [
        r"(\d{4}[-/]\d{2}[-/]\d{2}[-_]?\d{2}[-_]?\d{2}[-_]?\d{2})",
        r"IMG_(\d{8}_\d{6})",
        r"(\d{4}\d{2}\d{2}_\d{2}\d{2}\d{2})",
    ]

    DOOR_LOG_EXTENSIONS = [".csv", ".txt", ".log"]
    PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png", ".heic", ".raw"]
    TEMP_CSV_EXTENSIONS = [".csv"]

    MIN_READINGS_PER_HOUR = 4

    HANDOVER_TIME_TOLERANCE_MINUTES = 30

    ALERT_LEVELS = {
        "critical": ["temp_over_threshold", "temp_under_threshold"],
        "high": ["missing_readings", "photo_missing"],
        "medium": ["handover_time_conflict", "door_opened_long"],
    }

    @staticmethod
    def get_env(key: str, default: Any = None) -> Any:
        return os.getenv(key, default)

    @classmethod
    def from_env(cls) -> "Config":
        env_config = cls()
        
        temp_min = cls.get_env("TEMP_MIN")
        if temp_min:
            env_config.TEMP_THRESHOLD_MIN = float(temp_min)
            
        temp_max = cls.get_env("TEMP_MAX")
        if temp_max:
            env_config.TEMP_THRESHOLD_MAX = float(temp_max)
            
        input_dir = cls.get_env("INPUT_DIR")
        if input_dir:
            env_config.INPUT_DIR = Path(input_dir)
            
        output_dir = cls.get_env("OUTPUT_DIR")
        if output_dir:
            env_config.OUTPUT_DIR = Path(output_dir)
            
        return env_config

    @classmethod
    def ensure_directories(cls):
        for dir_path in [cls.INPUT_DIR, cls.OUTPUT_DIR, cls.ARCHIVE_DIR]:
            dir_path.mkdir(parents=True, exist_ok=True)
