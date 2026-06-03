from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime
import uuid


@dataclass
class SafetyRadiusRecord:
    record_id: str
    point_id: str
    building_name: str
    safety_radius: float
    measured_distance: float
    is_within_safety: bool
    remark: str = ""
    checked_by: str = ""
    checked_at: Optional[datetime] = None

    @classmethod
    def create(cls, point_id: str, building_name: str,
               safety_radius: float, measured_distance: float,
               is_within_safety: Optional[bool] = None,
               checked_by: str = "小陶") -> "SafetyRadiusRecord":
        if is_within_safety is None:
            is_within_safety = measured_distance >= safety_radius
        return cls(
            record_id=str(uuid.uuid4()),
            point_id=point_id,
            building_name=building_name,
            safety_radius=safety_radius,
            measured_distance=measured_distance,
            is_within_safety=is_within_safety,
            checked_by=checked_by,
            checked_at=datetime.now()
        )


@dataclass
class SafetyRadiusTable:
    table_id: str
    batch_id: str
    building_name: str
    records: List[SafetyRadiusRecord] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    created_by: str = ""

    @classmethod
    def create(cls, batch_id: str, building_name: str,
               created_by: str = "小陶") -> "SafetyRadiusTable":
        return cls(
            table_id=str(uuid.uuid4()),
            batch_id=batch_id,
            building_name=building_name,
            created_by=created_by
        )
