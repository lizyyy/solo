from dataclasses import dataclass
from typing import List, Optional
from drill_service.models.base import BaseModel


@dataclass
class ReportStep(BaseModel):
    step_index: int
    name: str
    status: str
    started_at: Optional[str]
    completed_at: Optional[str]
    result: str
    notes: str = ""


@dataclass
class DrillReport(BaseModel):
    report_id: str
    plan_id: str
    plan_name: str
    source_region: str
    target_region: str
    started_at: str
    completed_at: str
    overall_status: str
    steps: List[ReportStep]
    conclusion: str
    recommendations: List[str]
    
    @classmethod
    def from_dict(cls, data: dict):
        data = data.copy()
        data["steps"] = [ReportStep.from_dict(s) for s in data.get("steps", [])]
        return cls(**data)
    
    def to_dict(self):
        result = super().to_dict()
        result["steps"] = [s.to_dict() for s in self.steps]
        return result
