from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "station-overstay-api"
    storage_dir: str = "data"
    default_overstay_days: int = 7

    class Config:
        env_prefix = "STATION_"


settings = Settings()
