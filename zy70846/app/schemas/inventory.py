from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, Field


class InventoryItem(BaseModel):
    sku: str
    sku_name: str
    quantity: int
    unit: str = "个"
    unit_price: Optional[float] = None
    expiry_date: Optional[date] = None
    shelf_position: Optional[str] = None
    category: Optional[str] = None
    batch_no: Optional[str] = None


class InventoryRecord(BaseModel):
    id: str
    store_id: str
    store_name: str
    record_date: date
    operator: str
    items: list[InventoryItem]
    total_items: int = 0
    total_value: float = 0.0
    created_at: datetime = Field(default_factory=datetime.now)
    remark: Optional[str] = None
