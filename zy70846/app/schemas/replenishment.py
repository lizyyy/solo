from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, Field


class ReplenishmentItem(BaseModel):
    sku: str
    sku_name: str
    requested_quantity: int
    actual_quantity: int
    unit: str = "个"
    unit_price: Optional[float] = None
    category: Optional[str] = None
    remark: Optional[str] = None


class ReplenishmentRecord(BaseModel):
    id: str
    store_id: str
    store_name: str
    replenishment_date: date
    supplier: Optional[str] = None
    operator: str
    items: list[ReplenishmentItem]
    total_requested: int = 0
    total_actual: int = 0
    total_value: float = 0.0
    created_at: datetime = Field(default_factory=datetime.now)
    status: str = "completed"
    remark: Optional[str] = None
