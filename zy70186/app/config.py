from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./deposit.db"
    API_PREFIX: str = "/api/v1"
    APP_NAME: str = "合同履约保证金 API"
    
    class Config:
        env_file = ".env"


settings = Settings()
