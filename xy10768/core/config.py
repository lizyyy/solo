import os
from datetime import datetime

class Settings:
    APP_NAME = "ETL任务回放台"
    VERSION = "1.0.0"
    DEBUG = True
    
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DATA_DIR = os.path.join(BASE_DIR, "data")
    STATIC_DIR = os.path.join(BASE_DIR, "static")
    
    DATABASE_PATH = os.path.join(DATA_DIR, "etl_replay.db")
    
    SECRET_KEY = "etl-replay-secret-key-2024"
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24
    
    VALIDATION_RULES = {
        "required_fields": ["batch_id", "owner", "data_count", "transform_steps"],
        "max_batch_size": 10000,
        "allowed_statuses": ["pending", "validating", "validated", "failed", "replaying", "completed"]
    }
    
    OWNERS = ["张三", "李四", "王五", "赵六"]
    NODES = ["数据抽取", "数据清洗", "数据转换", "数据加载", "质量校验"]

settings = Settings()

os.makedirs(settings.DATA_DIR, exist_ok=True)
os.makedirs(settings.STATIC_DIR, exist_ok=True)
