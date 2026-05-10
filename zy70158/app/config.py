from pydantic_settings import BaseSettings
from datetime import timedelta


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./quota_service.db"
    APP_NAME: str = "API密钥配额服务"
    API_PREFIX: str = "/api/v1"
    
    DEFAULT_QUOTA_PER_MINUTE: int = 100
    DEFAULT_QUOTA_PER_HOUR: int = 1000
    DEFAULT_QUOTA_PER_DAY: int = 10000
    
    AUTO_APPROVE_LIMIT: int = 5
    HIGH_RISK_THRESHOLD: float = 5.0
    
    class Config:
        env_file = ".env"


settings = Settings()
