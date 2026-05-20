from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "代码片段运行配额台"
    SQLALCHEMY_DATABASE_URI: str = "sqlite:///./code_runner.db"
    
    DEFAULT_QUOTA_PER_WINDOW: int = 50
    QUOTA_WINDOW_MINUTES: int = 60
    MAX_RUNTIME_SECONDS: int = 30
    MAX_PENDING_REQUESTS: int = 50

    class Config:
        case_sensitive = True


settings = Settings()
