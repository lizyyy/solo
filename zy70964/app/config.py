from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./qc_service.db"
    app_name: str = "QC Review Service"

    class Config:
        env_file = ".env"


settings = Settings()
