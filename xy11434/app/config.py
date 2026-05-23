from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "your-secret-key-here-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    DATABASE_URL: str = "sqlite:///./lab_consumables.db"

    # 角色定义
    ROLES: List[str] = ["entry", "reviewer", "supervisor", "readonly", "secretary"]

    # 敏感字段（脱敏用）
    SENSITIVE_FIELDS: List[str] = ["phone", "id_card", "bank_account", "email"]

    class Config:
        case_sensitive = True


settings = Settings()
