from dataclasses import dataclass
from typing import Optional
from .base import BaseModel


@dataclass
class FoodSample(BaseModel):
    dish_id: str = ""
    dish_name: str = ""
    batch_id: str = ""
    batch_number: str = ""
    sample_weight: float = 0.0
    sample_box_code: str = ""
    fridge_location_id: str = ""
    fridge_full_location: str = ""
    sampling_time: str = ""
    sampler: str = ""
    retention_period_hours: int = 48
    scheduled_destruction_time: str = ""
    is_destroyed: bool = False
    destruction_time: Optional[str] = None
    destroyer: Optional[str] = None
    destruction_reason: str = "正常到期销毁"
    status: str = "active"
    notes: Optional[str] = None

    def get_status(self, current_time: str) -> str:
        if self.is_destroyed:
            return "destroyed"
        if current_time > self.scheduled_destruction_time:
            return "overdue"
        return "active"
