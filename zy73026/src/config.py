import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR / "data"
VACCINE_PHOTO_DIR = DATA_DIR / "vaccine_photos"
MEDICATION_IMPORT_DIR = DATA_DIR / "medication_imports"
ALERT_IMPORT_DIR = DATA_DIR / "alert_imports"
REPORT_DIR = DATA_DIR / "reports"
DB_PATH = DATA_DIR / "alertdb.sqlite3"

ERROR_CODES = {
    "E001": "参数缺失：{field} 为必填项",
    "E002": "文件不存在：{path}",
    "E003": "数据校验失败：{detail}",
    "E004": "来源ID重复，已跳过导入（幂等保护）",
    "E005": "用药剂量变更，提醒已进入待确认状态（待人工复核）",
    "E006": "数据库操作失败：{detail}",
    "E007": "目录不存在：{dir}",
    "E008": "宠物ID不存在：{pet_id}",
    "E009": "记录不存在：{record_id}",
}

ALERT_STATUSES = {
    "PENDING": "待处理",
    "CONFIRMED": "已确认",
    "RESOLVED": "已解决",
    "PENDING_REVIEW": "待人工复核",
}

TEMP_THRESHOLD_C = 30.0

DEFAULT_AUTHOR = "system"

def ensure_dirs():
    for d in [DATA_DIR, VACCINE_PHOTO_DIR, MEDICATION_IMPORT_DIR,
              ALERT_IMPORT_DIR, REPORT_DIR]:
        d.mkdir(parents=True, exist_ok=True)

def err(code: str, **kwargs) -> str:
    tmpl = ERROR_CODES.get(code, f"未知错误代码 {code}")
    return f"[{code}] {tmpl.format(**kwargs)}"
