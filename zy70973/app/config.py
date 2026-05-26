from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "街道活动报名管理系统"
    DATABASE_URL: str = "sqlite:///./activity.db"
    UPLOAD_DIR: str = "./uploads"
    MAX_BATCH_SIZE: int = 1000
    
    class Config:
        case_sensitive = True

@lru_cache()
def get_settings():
    return Settings()
