from dataclasses import dataclass
from typing import Optional
from .base import BaseModel


@dataclass
class Dish(BaseModel):
    name: str = ""
    category: str = ""
    meal_type: str = ""
    supplier: Optional[str] = None
    responsible_person: str = ""
