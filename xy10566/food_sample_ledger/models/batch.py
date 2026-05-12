from dataclasses import dataclass
from typing import Optional
from .base import BaseModel


@dataclass
class Batch(BaseModel):
    batch_number: str = ""
    dish_id: str = ""
    dish_name: str = ""
    ingredient_name: str = ""
    production_date: str = ""
    expiration_date: str = ""
    quantity: float = 0.0
    unit: str = "kg"
    supplier: Optional[str] = None
    is_locked: bool = False
    lock_reason: Optional[str] = None
    locked_at: Optional[str] = None
