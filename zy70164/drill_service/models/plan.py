from dataclasses import dataclass
from enum import Enum
from typing import List, Optional
from drill_service.models.base import BaseModel


class DrillPlanStatus(str, Enum):
    DRAFT = "draft"
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SWITCHING = "switching"
    READONLY_CHECKING = "readonly_checking"
    SWITCHED = "switched"
    ROLLBACK_PENDING = "rollback_pending"
    ROLLBACKING = "rollbacking"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


@dataclass
class DrillPlan(BaseModel):
    plan_id: str
    name: str
    source_region: str
    target_region: str
    current_step: int
    total_steps: int
    status: DrillPlanStatus
    created_at: str
    updated_at: str
    operator: str
    description: str = ""
    
    @classmethod
    def from_dict(cls, data: dict):
        data = data.copy()
        if isinstance(data["status"], str):
            data["status"] = DrillPlanStatus(data["status"])
        return cls(**data)
    
    def to_dict(self):
        result = super().to_dict()
        result["status"] = self.status.value
        return result
