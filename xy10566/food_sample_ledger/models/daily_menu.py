from dataclasses import dataclass, field
from typing import List, Optional
from .base import BaseModel


@dataclass
class DailyMenu(BaseModel):
    date: str = ""
    meal_type: str = ""
    dish_ids: List[str] = field(default_factory=list)
    notes: Optional[str] = None
