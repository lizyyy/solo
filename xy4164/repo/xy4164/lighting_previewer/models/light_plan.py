"""补光方案数据模型"""

from dataclasses import dataclass, field
from datetime import time
from typing import Dict, List, Optional
from enum import Enum


class PriorityLevel(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class SupplementInterval:
    zone_id: str
    start_hour: int
    end_hour: int
    power_percentage: float
    priority: PriorityLevel = PriorityLevel.MEDIUM
    estimated_ppfd: float = 0.0
    estimated_dli_contribution: float = 0.0
    estimated_energy: float = 0.0
    estimated_cost: float = 0.0
    notes: str = ""
    
    def to_dict(self) -> Dict:
        return {
            "zone_id": self.zone_id,
            "start_hour": self.start_hour,
            "end_hour": self.end_hour,
            "power_percentage": self.power_percentage,
            "priority": self.priority.value,
            "estimated_ppfd": self.estimated_ppfd,
            "estimated_dli_contribution": self.estimated_dli_contribution,
            "estimated_energy": self.estimated_energy,
            "estimated_cost": self.estimated_cost,
            "notes": self.notes
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> "SupplementInterval":
        return cls(
            zone_id=data["zone_id"],
            start_hour=data["start_hour"],
            end_hour=data["end_hour"],
            power_percentage=data["power_percentage"],
            priority=PriorityLevel(data.get("priority", "medium")),
            estimated_ppfd=data.get("estimated_ppfd", 0.0),
            estimated_dli_contribution=data.get("estimated_dli_contribution", 0.0),
            estimated_energy=data.get("estimated_energy", 0.0),
            estimated_cost=data.get("estimated_cost", 0.0),
            notes=data.get("notes", "")
        )
    
    def validate(self) -> List[str]:
        errors = []
        if self.start_hour < 0 or self.start_hour > 23:
            errors.append("开始小时必须在0-23之间")
        if self.end_hour < 0 or self.end_hour > 24:
            errors.append("结束小时必须在0-24之间")
        if self.power_percentage < 0 or self.power_percentage > 100:
            errors.append("功率百分比必须在0-100之间")
        return errors
    
    @property
    def duration_hours(self) -> int:
        if self.end_hour >= self.start_hour:
            return self.end_hour - self.start_hour
        return (24 - self.start_hour) + self.end_hour


@dataclass
class LightPlan:
    plan_id: str
    plan_name: str
    created_at: str
    base_date: str
    intervals: List[SupplementInterval] = field(default_factory=list)
    total_estimated_energy: float = 0.0
    total_estimated_cost: float = 0.0
    budget_limit: Optional[float] = None
    notes: str = ""
    custom_attributes: Dict[str, str] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            "plan_id": self.plan_id,
            "plan_name": self.plan_name,
            "created_at": self.created_at,
            "base_date": self.base_date,
            "intervals": [i.to_dict() for i in self.intervals],
            "total_estimated_energy": self.total_estimated_energy,
            "total_estimated_cost": self.total_estimated_cost,
            "budget_limit": self.budget_limit,
            "notes": self.notes,
            "custom_attributes": self.custom_attributes
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> "LightPlan":
        return cls(
            plan_id=data["plan_id"],
            plan_name=data.get("plan_name", ""),
            created_at=data["created_at"],
            base_date=data.get("base_date", ""),
            intervals=[SupplementInterval.from_dict(i) for i in data.get("intervals", [])],
            total_estimated_energy=data.get("total_estimated_energy", 0.0),
            total_estimated_cost=data.get("total_estimated_cost", 0.0),
            budget_limit=data.get("budget_limit"),
            notes=data.get("notes", ""),
            custom_attributes=data.get("custom_attributes", {})
        )
    
    def validate(self) -> List[str]:
        errors = []
        if not self.plan_id or not self.plan_id.strip():
            errors.append("方案ID不能为空")
        
        for interval in self.intervals:
            errors.extend(interval.validate())
        
        return errors
    
    def get_intervals_for_zone(self, zone_id: str) -> List[SupplementInterval]:
        return [i for i in self.intervals if i.zone_id == zone_id]
    
    def get_zone_energy(self, zone_id: str) -> float:
        return sum(i.estimated_energy for i in self.intervals if i.zone_id == zone_id)
    
    def get_zone_cost(self, zone_id: str) -> float:
        return sum(i.estimated_cost for i in self.intervals if i.zone_id == zone_id)
    
    def get_zones(self) -> List[str]:
        return list(set(i.zone_id for i in self.intervals))
