from dataclasses import dataclass
from enum import Enum
from drill_service.models.base import BaseModel


class RegionStatus(str, Enum):
    ACTIVE = "active"
    STANDBY = "standby"
    DRAINING = "draining"
    READ_ONLY = "read_only"
    OFFLINE = "offline"


@dataclass
class Region(BaseModel):
    name: str
    status: RegionStatus
    traffic_weight: int
    is_read_only: bool
    description: str = ""
    
    @classmethod
    def from_dict(cls, data: dict):
        data = data.copy()
        if isinstance(data["status"], str):
            data["status"] = RegionStatus(data["status"])
        return cls(**data)
    
    def to_dict(self):
        result = super().to_dict()
        result["status"] = self.status.value
        return result
