import os


class Settings:
    DB_URL: str = os.getenv("DB_URL", "sqlite:///./finance.db")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    API_PREFIX: str = os.getenv("API_PREFIX", "/api/v1")


settings = Settings()
