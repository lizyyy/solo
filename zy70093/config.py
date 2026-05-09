from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./fast_charge.db"
    SLA_WARNING_MINUTES: int = 15
    SLA_EXPIRED_MINUTES: int = 30
    DISPATCH_TIMEOUT_MINUTES: int = 10
    
    class Config:
        env_file = ".env"


settings = Settings()
