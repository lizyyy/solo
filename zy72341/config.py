import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    DATA_DIR = os.getenv("DATA_DIR", "./data")
    DEBUG = os.getenv("DEBUG", "True").lower() == "true"
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", "5000"))

    ANSWERS_FILE = os.path.join(DATA_DIR, "answers.json")
    WEIGHTS_FILE = os.path.join(DATA_DIR, "weights.json")
    ERROR_LOGS_FILE = os.path.join(DATA_DIR, "error_logs.json")
    REPORTS_DIR = os.path.join(DATA_DIR, "reports")

    STATUS_TYPES = {
        "NORMAL": "正常",
        "DUPLICATE_PENDING": "重复提交待复核",
        "OLD_STANDARD": "旧口径补录",
        "REVIEWED": "已复核（已处理）",
        "BOUNDARY_ALERT": "边界值告警",
        "MANUAL_CORRECTED": "人工已修正",
        "RERUN_DONE": "重跑已完成",
    }

    STATUS_COLORS = {
        "NORMAL": "#10b981",
        "DUPLICATE_PENDING": "#f59e0b",
        "OLD_STANDARD": "#6366f1",
        "REVIEWED": "#3b82f6",
        "BOUNDARY_ALERT": "#ef4444",
        "MANUAL_CORRECTED": "#8b5cf6",
        "RERUN_DONE": "#14b8a6",
    }

    BOUNDARY_TYPES = {
        "FULL_SCORE": "满分/超满分",
        "ZERO_SCORE": "零分/负分",
        "PASS_LINE": "及格线附近",
        "SHORT_ANSWER": "答案内容过短",
    }

    ERROR_TYPES = {
        "OLD_STANDARD": "旧口径补录误差",
        "WEIGHT_MISMATCH": "权重版本不匹配",
        "MANUAL_ADJUST": "人工调整说明",
    }

    @classmethod
    def ensure_data_dir(cls):
        os.makedirs(cls.DATA_DIR, exist_ok=True)
        os.makedirs(cls.REPORTS_DIR, exist_ok=True)
