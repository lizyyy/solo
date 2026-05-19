from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str = "sqlite:///./bundle_budget.db"
    PROJECT_NAME: str = "Bundle Budget API"
    DEFAULT_BUDGET_KB: int = 200

    class Config:
        case_sensitive = True
        env_file = ".env"


settings = Settings()
