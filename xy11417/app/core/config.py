from pydantic_settings import BaseSettings
from typing import List
from enum import Enum

class UserRole(str, Enum):
    DATA_ENTRY = "data_entry"
    REVIEWER = "reviewer"
    MANAGER = "manager"
    READ_ONLY = "read_only"

class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    RETRYING = "retrying"
    SUCCESS = "success"
    FAILED = "failed"
    DEAD_LETTER = "dead_letter"
    MANUAL_REVIEW = "manual_review"
    COMPENSATED = "compensated"
    CLOSED = "closed"

class RetryCategory(str, Enum):
    NETWORK_ERROR = "network_error"
    DATA_VALIDATION = "data_validation"
    SYSTEM_ERROR = "system_error"
    BUSINESS_CONFLICT = "business_conflict"
    DUPLICATE_ORDER = "duplicate_order"
    MISSING_DATA = "missing_data"
    THIRD_PARTY_TIMEOUT = "third_party_timeout"

class SourceType(str, Enum):
    RESIDENT_SCREENSHOT = "resident_screenshot"
    TECHNICIAN_RECEIPT = "technician_receipt"
    MATERIAL_FORM = "material_form"
    SUPPLEMENTARY_FORM = "supplementary_form"
    SCHEDULE_RECORD = "schedule_record"

class Settings(BaseSettings):
    PROJECT_NAME: str = "物业维修派单重试补偿队列服务"
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str = "sqlite:///./repair_queue.db"
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    MAX_RETRY_COUNT: int = 5
    RETRY_DELAY_SECONDS: int = 60
    RETRY_BACKOFF_MULTIPLIER: int = 2
    QUEUE_PROCESS_INTERVAL: int = 30
    DEAD_LETTER_AFTER_HOURS: int = 24
    
    class Config:
        env_file = ".env"

settings = Settings()
