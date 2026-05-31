import json
import os
from typing import Optional
from datetime import datetime


class Config:
    DATA_DIR = "data"
    SUBTITLES_DIR = os.path.join(DATA_DIR, "subtitles")
    HISTORY_DIR = os.path.join(DATA_DIR, "history")
    EXPORT_DIR = os.path.join(DATA_DIR, "exports")
    GUEST_LISTS_DIR = os.path.join(DATA_DIR, "guest_lists")

    MUTE_THRESHOLD_SECONDS = 3.0
    MIN_ISSUE_CONFIDENCE = 0.5

    @classmethod
    def ensure_dirs(cls):
        for dir_path in [
            cls.DATA_DIR,
            cls.SUBTITLES_DIR,
            cls.HISTORY_DIR,
            cls.EXPORT_DIR,
            cls.GUEST_LISTS_DIR,
        ]:
            os.makedirs(dir_path, exist_ok=True)


def format_time(seconds: float) -> str:
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"
    return f"{minutes:02d}:{secs:02d},{millis:03d}"


def parse_time(time_str: str) -> float:
    time_str = time_str.strip().replace(",", ".")
    parts = time_str.split(":")
    if len(parts) == 3:
        h, m, s = parts
        return float(h) * 3600 + float(m) * 60 + float(s)
    elif len(parts) == 2:
        m, s = parts
        return float(m) * 60 + float(s)
    return float(time_str)


def generate_issue_id(episode_id: str, idx: int) -> str:
    timestamp = datetime.now().strftime("%Y%m%d")
    return f"{episode_id}_{timestamp}_{idx:04d}"


def save_json(data: dict, filepath: str):
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)


def load_json(filepath: str) -> Optional[dict]:
    if not os.path.exists(filepath):
        return None
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)
