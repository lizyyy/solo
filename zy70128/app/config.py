from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """应用配置类"""

    app_name: str = "赛事成绩申诉系统"
    app_version: str = "1.0.0"
    debug: bool = True

    database_url: str = "sqlite+aiosqlite:///./race_appeal.db"
    test_database_url: str = "sqlite+aiosqlite:///:memory:"

    max_retry_attempts: int = 3
    retry_delay_seconds: int = 5

    export_max_rows: int = 10000

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    """获取应用配置（单例）"""
    return Settings()
