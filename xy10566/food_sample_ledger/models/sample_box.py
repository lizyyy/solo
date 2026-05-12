from dataclasses import dataclass
from typing import Optional
from .base import BaseModel


@dataclass
class SampleBox(BaseModel):
    box_code: str = ""
    capacity: float = 500.0
    current_sample_id: Optional[str] = None
    is_available: bool = True
    notes: Optional[str] = None
