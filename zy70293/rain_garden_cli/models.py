"""数据模型定义"""

from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Optional, List, Dict, Any
import json


@dataclass
class RainGarden:
    """雨水花园点位"""
    id: str
    name: str
    location: str
    area: float
    plant_types: List[str]
    created_at: str
    is_active: bool = True
    last_inspection: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "location": self.location,
            "area": self.area,
            "plant_types": self.plant_types,
            "created_at": self.created_at,
            "is_active": self.is_active,
            "last_inspection": self.last_inspection,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RainGarden":
        return cls(**data)


@dataclass
class RainfallRecord:
    """降雨记录"""
    id: str
    garden_id: str
    date: str
    rainfall: float
    source: str
    import_time: str
    is_verified: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "garden_id": self.garden_id,
            "date": self.date,
            "rainfall": self.rainfall,
            "source": self.source,
            "import_time": self.import_time,
            "is_verified": self.is_verified,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RainfallRecord":
        return cls(**data)


@dataclass
class PondingRecord:
    """积水记录"""
    id: str
    garden_id: str
    date: str
    depth: float
    duration: float
    location: str
    recorder: str
    photo_reference: Optional[str] = None
    is_matched: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "garden_id": self.garden_id,
            "date": self.date,
            "depth": self.depth,
            "duration": self.duration,
            "location": self.location,
            "recorder": self.recorder,
            "photo_reference": self.photo_reference,
            "is_matched": self.is_matched,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PondingRecord":
        return cls(**data)


@dataclass
class PlantStatus:
    """植物状态"""
    id: str
    garden_id: str
    date: str
    plant_type: str
    health_status: str
    growth_rate: float
    notes: Optional[str] = None
    inspector: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "garden_id": self.garden_id,
            "date": self.date,
            "plant_type": self.plant_type,
            "health_status": self.health_status,
            "growth_rate": self.growth_rate,
            "notes": self.notes,
            "inspector": self.inspector,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PlantStatus":
        return cls(**data)


@dataclass
class InspectionSchedule:
    """巡查安排"""
    id: str
    garden_id: str
    scheduled_date: str
    volunteer: str
    status: str
    completed_date: Optional[str] = None
    notes: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "garden_id": self.garden_id,
            "scheduled_date": self.scheduled_date,
            "volunteer": self.volunteer,
            "status": self.status,
            "completed_date": self.completed_date,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "InspectionSchedule":
        return cls(**data)


@dataclass
class CheckResult:
    """检查结果"""
    id: str
    check_type: str
    status: str
    message: str
    details: Dict[str, Any]
    timestamp: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "check_type": self.check_type,
            "status": self.status,
            "message": self.message,
            "details": self.details,
            "timestamp": self.timestamp,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CheckResult":
        return cls(**data)


@dataclass
class DataStore:
    """数据存储"""
    gardens: Dict[str, RainGarden] = field(default_factory=dict)
    rainfall_records: Dict[str, RainfallRecord] = field(default_factory=dict)
    ponding_records: Dict[str, PondingRecord] = field(default_factory=dict)
    plant_status: Dict[str, PlantStatus] = field(default_factory=dict)
    inspection_schedules: Dict[str, InspectionSchedule] = field(default_factory=dict)
    check_results: List[CheckResult] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "gardens": {k: v.to_dict() for k, v in self.gardens.items()},
            "rainfall_records": {k: v.to_dict() for k, v in self.rainfall_records.items()},
            "ponding_records": {k: v.to_dict() for k, v in self.ponding_records.items()},
            "plant_status": {k: v.to_dict() for k, v in self.plant_status.items()},
            "inspection_schedules": {k: v.to_dict() for k, v in self.inspection_schedules.items()},
            "check_results": [r.to_dict() for r in self.check_results],
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DataStore":
        return cls(
            gardens={k: RainGarden.from_dict(v) for k, v in data.get("gardens", {}).items()},
            rainfall_records={k: RainfallRecord.from_dict(v) for k, v in data.get("rainfall_records", {}).items()},
            ponding_records={k: PondingRecord.from_dict(v) for k, v in data.get("ponding_records", {}).items()},
            plant_status={k: PlantStatus.from_dict(v) for k, v in data.get("plant_status", {}).items()},
            inspection_schedules={k: InspectionSchedule.from_dict(v) for k, v in data.get("inspection_schedules", {}).items()},
            check_results=[CheckResult.from_dict(r) for r in data.get("check_results", [])],
        )
