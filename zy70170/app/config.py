from pathlib import Path
import os
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
LOG_DIR = BASE_DIR / "logs"

DATA_DIR.mkdir(exist_ok=True)
LOG_DIR.mkdir(exist_ok=True)

load_dotenv(BASE_DIR / ".env")


class Settings:
    def __init__(self):
        self.app_name = os.getenv("APP_NAME", "GPU Task Queue Service")
        self.version = os.getenv("VERSION", "1.0.0")
        self.database_url = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR}/gpu_queue.db")
        
        self.max_retry_count = int(os.getenv("MAX_RETRY_COUNT", "3"))
        self.default_priority = int(os.getenv("DEFAULT_PRIORITY", "5"))
        self.default_max_duration_minutes = int(os.getenv("DEFAULT_MAX_DURATION_MINUTES", "60"))
        self.default_timeout_minutes = int(os.getenv("DEFAULT_TIMEOUT_MINUTES", "120"))
        
        self.scheduler_interval_seconds = int(os.getenv("SCHEDULER_INTERVAL_SECONDS", "5"))
        self.gpu_check_interval_seconds = int(os.getenv("GPU_CHECK_INTERVAL_SECONDS", "10"))


settings = Settings()
