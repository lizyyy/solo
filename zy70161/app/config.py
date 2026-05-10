from pydantic import BaseModel
from typing import Optional


class Settings(BaseModel):
    APP_NAME: str = "搜索词黑白名单 API"
    APP_VERSION: str = "1.0.0"
    DATABASE_URL: str = "sqlite:///./search_terms.db"


settings = Settings()
