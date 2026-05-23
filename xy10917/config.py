from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./theater_seats.db"
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "剧场座位保留 API"
    DEFAULT_RESERVE_MINUTES: int = 30

    class Config:
        case_sensitive = True

settings = Settings()