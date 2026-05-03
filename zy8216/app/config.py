from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "实验动物中心管理系统"
    APP_VERSION: str = "1.0.0"
    DATABASE_URL: str = "sqlite:///./animal_center.db"
    DEBUG: bool = True

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
