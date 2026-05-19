from pydantic_settings import BaseSettings
from datetime import timedelta


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str = "sqlite:///./pet_pharmacy.db"
    
    SENSITIVE_FIELDS: list = ["owner_phone", "owner_id_card", "pet_birthday"]
    MASK_PATTERN: str = "****"
    
    AUDIT_LOG_RETENTION_DAYS: int = 90
    MAX_BATCH_SIZE: int = 50
    MAX_RETRY_COUNT: int = 3
    
    DOSE_CHECK_ENABLED: bool = True
    EXPIRY_CHECK_ENABLED: bool = True
    CONTRAINDICATION_CHECK_ENABLED: bool = True
    
    class Config:
        case_sensitive = True


settings = Settings()
