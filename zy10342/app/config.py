from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "接口故障声明 API"
    DATABASE_URL: str = "sqlite:///./fault_declaration.db"
    
    class Config:
        case_sensitive = True

settings = Settings()
