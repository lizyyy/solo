from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "便利店对账服务"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    STORAGE_PATH: str = "./data"
    UPLOAD_PATH: str = "./data/uploads"
    REPORT_PATH: str = "./data/reports"
    
    class Config:
        env_file = ".env"


settings = Settings()
