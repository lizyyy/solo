import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    
    app_name: str = "电子回单补打服务"
    database_url: str = "sqlite:///./receipt_service.db"
    max_download_count: int = 3
    default_permission_valid_days: int = 30
    signature_algorithm: str = "SHA256"
    watermark_text: str = "电子回单补打副本"
    export_format: str = "CSV"


settings = Settings()