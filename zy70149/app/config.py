from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    app_name: str = "缓存预热编排 API"
    database_url: str = "sqlite:///./cache_warmup.db"
    default_concurrency: int = 10
    default_rate_limit: int = 100
    default_qps_limit: int = 50

    class Config:
        env_file = ".env"


settings = Settings()
