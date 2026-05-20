from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "遥测异常确认 API"
    SQLALCHEMY_DATABASE_URL: str = "sqlite:///./telemetry.db"


settings = Settings()
