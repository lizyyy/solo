from dataclasses import dataclass
from typing import Optional
from .base import BaseModel


@dataclass
class InspectionRecord(BaseModel):
    sample_id: str = ""
    dish_name: str = ""
    batch_number: str = ""
    inspection_time: str = ""
    inspector: str = ""
    inspection_type: str = "常规抽检"
    result: str = "正常"
    is_abnormal: bool = False
    abnormal_details: Optional[str] = None
    corrective_actions: Optional[str] = None
    follow_up_required: bool = False
    follow_up_completed: bool = False
    follow_up_time: Optional[str] = None
    notes: Optional[str] = None
