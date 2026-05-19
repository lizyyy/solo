from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    app_name: str = "换电运营值班系统"
    app_version: str = "1.0.0"
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True
    
    sensitive_fields_str: str = "phone,id_card,email,user_name,address"
    mask_pattern: str = "****"
    
    @property
    def sensitive_fields(self) -> List[str]:
        return [f.strip() for f in self.sensitive_fields_str.split(",")]
    
    class Config:
        env_file = ".env"
        env_prefix = ""


settings = Settings()
