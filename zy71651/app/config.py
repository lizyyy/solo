from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "3D打印支撑量估算服务"
    version: str = "1.0.0"
    api_prefix: str = "/api"

    database_url: str = "sqlite:///./estimation.db"
    upload_dir: Path = Path("./uploads")
    report_dir: Path = Path("./reports")

    default_material_density: float = 1.24
    default_nozzle_diameter: float = 0.4
    default_print_speed: float = 50.0
    default_infill_density: float = 20.0

    def ensure_dirs(self) -> None:
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.report_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_dirs()
