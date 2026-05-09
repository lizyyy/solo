from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "门店库存管理系统"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/inventory"
    TEST_DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/inventory_test"

    REDIS_URL: str = "redis://localhost:6379/0"

    JWT_SECRET_KEY: str = "your-super-secret-key-please-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    MAX_RETRY_COUNT: int = 3
    RETRY_DELAY_SECONDS: int = 2

    EXPORT_MAX_ROWS: int = 10000
    BATCH_SIZE: int = 100

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
