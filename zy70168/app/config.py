from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/metrics.db"
    DEFAULT_LATENCY_WINDOW_SECONDS: int = 3600  
    MAX_HISTORY_VERSIONS: int = 50

    class Config:
        env_file = ".env"


settings = Settings()
