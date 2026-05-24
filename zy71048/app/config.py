from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./blast_notice.db"
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "采石场爆破通知 API"
    DEBUG: bool = True
    ALLOWED_WIND_DIRECTIONS: str = "北,东北,东"
    MAX_WIND_SPEED: float = 10.0

    class Config:
        env_file = ".env"

    @property
    def allowed_wind_list(self) -> List[str]:
        return [d.strip() for d in self.ALLOWED_WIND_DIRECTIONS.split(",")]


settings = Settings()
