from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "公益书库管理系统"
    
    DATABASE_URL: str = "sqlite:///./book_library.db"
    
    SENSITIVE_FIELDS: List[str] = ["donor_phone", "donor_idcard", "operator_phone"]
    
    ISBN_REQUIRED: bool = False
    
    MAX_BATCH_SIZE: int = 100
    
    class Config:
        case_sensitive = True


settings = Settings()
