import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent

SAMPLE_AUDIO_DIR = BASE_DIR / "sample_data" / "audio"
SAMPLE_EXCEL_DIR = BASE_DIR / "sample_data" / "excel"
OUTPUT_DIR = BASE_DIR / "output"
LOG_DIR = BASE_DIR / "logs"

AUDIO_EXTENSIONS = {".wav", ".mp3", ".flac", ".m4a", ".aac"}

EXCEL_COLUMNS = {
    "track_id": "曲目编号",
    "track_name": "曲目名称",
    "student_name": "学生姓名",
    "class_date": "上课日期",
    "duration": "时长(秒)",
    "authorized": "已授权",
    "version": "版本",
    "notes": "备注"
}

for dir_path in [OUTPUT_DIR, LOG_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)
