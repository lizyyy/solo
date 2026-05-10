from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "备选供应商切换服务"
    app_version: str = "1.0.0"
    database_url: str = "sqlite:///./supplier_switch.db"

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
