from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./controlled_drugs.db"
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "管制药品交接 API"
    
    class Config:
        case_sensitive = True

settings = Settings()
