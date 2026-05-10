from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "动物园饲料日配系统"
    API_VERSION: str = "v1"
    DEBUG: bool = True

    class Config:
        env_file = ".env"


settings = Settings()
