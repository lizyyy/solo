from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ForecastRequest(BaseModel):
    store_id: int = Field(..., gt=0)
    material_id: Optional[int] = Field(None, gt=0)
    forecast_days: int = Field(7, ge=1, le=30)
    historical_days: int = Field(30, ge=7, le=90)


class ForecastItem(BaseModel):
    material_id: int
    material_name: str
    category: str
    current_stock: float
    unit: str
    avg_daily_consumption: float
    forecast_consumption: float
    estimated_runout_days: Optional[float]
    safety_stock_level: float
    reorder_point: float
    need_replenishment: bool
    suggested_quantity: float


class ForecastResponse(BaseModel):
    store_id: int
    store_name: str
    forecast_date: datetime
    forecast_days: int
    items: List[ForecastItem]
    generated_at: datetime
