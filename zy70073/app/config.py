from pydantic import BaseModel


class Settings(BaseModel):
    DATABASE_URL: str = "sqlite:///./procurement.db"
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "采购合同履约预警服务"

    DEFAULT_LATE_DELIVERY_RATE: float = 0.001
    DEFAULT_QUALITY_PENALTY_RATE: float = 0.1
    WARNING_DAYS_BEFORE_DUE: int = 3
    MAX_COMPENSATION_RETRIES: int = 3


settings = Settings()
