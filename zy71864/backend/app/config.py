from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./sequence_diagnosis.db"
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "数列递推诊断系统"

    class Config:
        env_file = ".env"


settings = Settings()
