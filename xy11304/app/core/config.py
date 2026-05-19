from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "社区食堂配餐管理系统"
    
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    LOG_DIR: str = os.path.join(BASE_DIR, "logs")
    EXPORT_DIR: str = os.path.join(BASE_DIR, "exports")
    DATA_DIR: str = os.path.join(BASE_DIR, "data")
    
    LOG_LEVEL: str = "INFO"
    
    MASK_SENSITIVE_FIELDS: bool = True
    SENSITIVE_FIELDS: list = ["id_card", "phone", "address"]
    
    class Config:
        case_sensitive = True


settings = Settings()

os.makedirs(settings.LOG_DIR, exist_ok=True)
os.makedirs(settings.EXPORT_DIR, exist_ok=True)
os.makedirs(settings.DATA_DIR, exist_ok=True)
