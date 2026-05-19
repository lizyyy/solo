from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    
    DATABASE_URL: str = "sqlite:///./data/hazard_management.db"
    
    SENSITIVE_FIELDS: List[str] = ["phone", "id_card", "email", "address"]
    SENSITIVE_MASK_CHAR: str = "*"
    SENSITIVE_MASK_KEEP_START: int = 3
    SENSITIVE_MASK_KEEP_END: int = 4
    
    DATA_DIR: str = "./data"
    IMPORT_DIR: str = "./data/imports"
    EXPORT_DIR: str = "./data/exports"
    REPORT_DIR: str = "./data/reports"
    LOG_DIR: str = "./logs"
    
    ALLOWED_IMPORT_EXTENSIONS: List[str] = [".csv", ".json", ".xlsx"]
    
    class Config:
        case_sensitive = True


settings = Settings()
