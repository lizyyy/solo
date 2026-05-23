from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "学校实验室耗材验收回放链路服务"
    APP_VERSION: str = "1.0.0"
    
    DATABASE_URL: str = "sqlite:///./lab_consumables.db"
    
    UPLOAD_DIR: str = "./uploads"
    EXPORT_DIR: str = "./exports"
    LOG_DIR: str = "./logs"
    
    SECRET_KEY: str = "lab-consumables-secret-key-2024"
    ALGORITHM: str = "HS256"
    
    MAX_RETRY_COUNT: int = 3
    RETRY_DELAY_SECONDS: int = 60
    
    class Config:
        env_file = ".env"


settings = Settings()
