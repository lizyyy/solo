from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "仓库夜班排班系统"
    
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    
    SENSITIVE_FIELDS: list = ["phone", "id_card", "password", "token"]
    
    class Config:
        case_sensitive = True


settings = Settings()
