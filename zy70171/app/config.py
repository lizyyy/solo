from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./vector_index.db"

    class Config:
        env_file = ".env"


settings = Settings()
