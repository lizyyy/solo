from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, Field


class SalesItem(BaseModel):
    sku: str
    sku_name: str
    quantity: int
    unit_price: float
    total_amount: float
    unit: str = "个"
    category: Optional[str] = None


class SalesRecord(BaseModel):
    id: str
    store_id: str
    store_name: str
    start_date: date
    end_date: date
    items: list[SalesItem]
    total_items: int = 0
    total_amount: float = 0.0
    total_transactions: int = 0
    created_at: datetime = Field(default_factory=datetime.now)
    source: str = "POS系统"
