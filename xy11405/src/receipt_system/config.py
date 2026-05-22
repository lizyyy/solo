from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./receipt_system.db"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    DEBUG: bool = True
    MAX_RETRY_COUNT: int = 3
    RETRY_DELAY_SECONDS: int = 60

    class Config:
        env_file = ".env"


settings = Settings()
