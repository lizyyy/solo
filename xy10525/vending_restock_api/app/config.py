from pydantic_settings import BaseSettings
from datetime import timedelta


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./vending_restock.db"
    API_TITLE: str = "售卖机补货路线 API"
    API_VERSION: str = "1.0.0"
    EXPIRE_WARNING_DAYS: int = 3
    ROUTE_DEFAULT_CAPACITY: int = 500
    IDEMPOTENT_EXPIRE_HOURS: int = 24

    class Config:
        env_file = ".env"


settings = Settings()
