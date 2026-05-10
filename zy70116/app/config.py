from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "餐饮储值卡退款系统"
    version: str = "1.0.0"
    
    database_url: str = "sqlite:///./prepaid_card.db"
    
    class Config:
        env_file = ".env"


settings = Settings()
