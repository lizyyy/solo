from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "Redis Structure Audit API"
    app_version: str = "1.0.0"
    debug: bool = True
    
    database_url: str = "sqlite+aiosqlite:///./redis_audit.db"
    
    upload_dir: str = "./uploads"
    reports_dir: str = "./reports"
    
    max_upload_size: int = 10 * 1024 * 1024  # 10MB
    
    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
