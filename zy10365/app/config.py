class Settings:
    database_url: str = "sqlite:///./gray_verification.db"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    env: str = "development"


def get_settings():
    return Settings()
