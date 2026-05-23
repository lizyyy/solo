from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "charging_pile_inspection_secret_key_2024"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    DATABASE_URL: str = "sqlite:///./charging_pile.db"

    class Config:
        case_sensitive = True


settings = Settings()
