from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "计量器具借用校准服务"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    DATABASE_URL: str = "sqlite:///./metrology.db"
    DATABASE_ECHO: bool = False
    
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    
    DEFAULT_CALIBRATION_MONTHS: int = 12
    DEFAULT_BORROW_DAYS: int = 30
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
