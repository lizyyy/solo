from dataclasses import dataclass
from typing import Dict, List
from drill_service.models.base import BaseModel


@dataclass
class TrafficWeight(BaseModel):
    region_name: str
    weight: int


@dataclass
class TrafficSwitch(BaseModel):
    switch_id: str
    plan_id: str
    step_index: int
    traffic_weights: List[TrafficWeight]
    timestamp: str
    operator: str
    
    @classmethod
    def from_dict(cls, data: dict):
        data = data.copy()
        data["traffic_weights"] = [
            TrafficWeight.from_dict(tw) for tw in data.get("traffic_weights", [])
        ]
        return cls(**data)
    
    def to_dict(self):
        result = super().to_dict()
        result["traffic_weights"] = [
            tw.to_dict() for tw in self.traffic_weights]
        return result
