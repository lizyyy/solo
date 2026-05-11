import os
from pathlib import Path

APP_NAME = "ortho_queue"
CONFIG_DIR = Path(os.environ.get("ORTHO_QUEUE_CONFIG", Path.home() / ".ortho_queue"))
DB_PATH = CONFIG_DIR / "appointments.db"
EXPORT_DIR = CONFIG_DIR / "exports"

DEFAULT_DOCTOR_MAX_DAILY = 8
DEFAULT_MIN_REVIEW_INTERVAL_DAYS = 14

STAGES = [
    "初诊",
    "方案确认",
    "托槽粘接",
    "常规复诊",
    "紧急调整",
    "保持器佩戴",
    "结束复诊",
]

REMINDER_TYPES = [
    "短信",
    "电话",
    "微信",
    "邮件",
]

EMERGENCY_REASONS = [
    "托槽脱落",
    "弓丝断裂",
    "结扎丝扎嘴",
    "疼痛难忍",
    "其他紧急情况",
]

APPOINTMENT_STATUS = [
    "待确认",
    "已确认",
    "已完成",
    "已取消",
    "已改约",
    "急诊",
]
