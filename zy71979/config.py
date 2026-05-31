import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
EXPORT_DIR = BASE_DIR / "exports"
UPLOAD_DIR = BASE_DIR / "uploads"

DATA_DIR.mkdir(exist_ok=True)
EXPORT_DIR.mkdir(exist_ok=True)
UPLOAD_DIR.mkdir(exist_ok=True)

DATABASE_URL = f"sqlite:///{DATA_DIR / 'audit_system.db'}"

CHANGE_TYPES = {
    "MATERIAL_SUPPLEMENT": "补材料",
    "CONCLUSION_CHANGE": "结论变更",
    "DATA_CORRECTION": "数据修正",
    "SCREEN_REFRESH": "筛选刷新",
    "BATCH_PROCESS": "批量处理",
}

ANOMALY_TYPES = {
    "SENSITIVE_DATA_LEAK": "敏感词漏脱敏",
    "QUALITY_ISSUE": "质检问题",
    "KNOWLEDGE_ERROR": "知识库错误",
    "TIMING_ISSUE": "时序问题",
    "OTHER": "其他异常",
}

DATA_SOURCE_TYPES = {
    "QUALITY_FORM": "质检表",
    "CUSTOMER_SERVICE": "客服对话",
    "KNOWLEDGE_BASE": "知识库导出",
}
