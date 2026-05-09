import os
from typing import Optional

class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./seal_borrow.db")
    API_PREFIX: str = "/api"
    PROJECT_NAME: str = "印章外借审批服务"
    VERSION: str = "1.0.0"
    
    TIMEOUT_LEVEL1_HOURS: int = 24
    TIMEOUT_LEVEL2_HOURS: int = 48
    TIMEOUT_LEVEL3_HOURS: int = 72
    TIMEOUT_LEVEL4_HOURS: int = 168
    
    MAX_RETRY_COUNT: int = 3
    RETRY_INTERVAL_SECONDS: int = 300

settings = Settings()
