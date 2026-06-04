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

    STATUS_TYPES = {
        "NORMAL": "正常",
        "DUPLICATE_PENDING": "重复提交待复核",
        "OLD_STANDARD": "旧口径补录",
        "REVIEWED": "已复核",
    }

    @classmethod
    def ensure_data_dir(cls):
        os.makedirs(cls.DATA_DIR, exist_ok=True)
