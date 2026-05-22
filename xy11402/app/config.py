from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./cold_chain.db"
    MAX_RETRY_COUNT: int = 3
    RETRY_INTERVAL_MINUTES: int = 5
    SCHEDULER_ENABLED: bool = True

    class Config:
        env_file = ".env"


settings = Settings()
