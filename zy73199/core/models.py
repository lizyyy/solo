from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class ReplayStatus(Enum):
    PENDING = "待计算"
    SUCCESS = "计算成功"
    FAILED_FORMULA = "公式错误"
    FAILED_UNIT = "单位缺失"
    FAILED_THRESHOLD = "超阈值"
    BOUNDARY = "边界样本"
    DRAFT = "草稿"


@dataclass
class Parameter:
    name: str
    value: float
    unit: str
    source: str = "input"


@dataclass
class CalculationStep:
    step_name: str
    formula: str
    input_values: Dict[str, float]
    input_units: Dict[str, str]
    result_value: Optional[float]
    result_unit: Optional[str]
    error_msg: Optional[str] = None


@dataclass
class ReplayRecord:
    record_id: str
    problem_id: str
    problem_title: str
    version: int
    status: ReplayStatus
    parameters: List[Parameter]
    steps: List[CalculationStep]
    final_result: Optional[float] = None
    final_unit: Optional[str] = None
    fail_reason: Optional[str] = None
    fail_detail: Optional[str] = None
    is_boundary: bool = False
    boundary_type: Optional[str] = None
    remark: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    created_by: str = "学生草稿"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "problem_id": self.problem_id,
            "problem_title": self.problem_title,
            "version": self.version,
            "status": self.status.value,
            "parameters": [
                {"name": p.name, "value": p.value, "unit": p.unit, "source": p.source}
                for p in self.parameters
            ],
            "steps": [
                {
                    "step_name": s.step_name,
                    "formula": s.formula,
                    "input_values": s.input_values,
                    "input_units": s.input_units,
                    "result_value": s.result_value,
                    "result_unit": s.result_unit,
                    "error_msg": s.error_msg,
                }
                for s in self.steps
            ],
            "final_result": self.final_result,
            "final_unit": self.final_unit,
            "fail_reason": self.fail_reason,
            "fail_detail": self.fail_detail,
            "is_boundary": self.is_boundary,
            "boundary_type": self.boundary_type,
            "remark": self.remark,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "created_by": self.created_by,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ReplayRecord":
        record = cls(
            record_id=data["record_id"],
            problem_id=data["problem_id"],
            problem_title=data["problem_title"],
            version=data["version"],
            status=ReplayStatus(data["status"]),
            parameters=[Parameter(**p) for p in data["parameters"]],
            steps=[CalculationStep(**s) for s in data["steps"]],
            final_result=data.get("final_result"),
            final_unit=data.get("final_unit"),
            fail_reason=data.get("fail_reason"),
            fail_detail=data.get("fail_detail"),
            is_boundary=data.get("is_boundary", False),
            boundary_type=data.get("boundary_type"),
            remark=data.get("remark", ""),
            created_by=data.get("created_by", "学生草稿"),
        )
        record.created_at = datetime.fromisoformat(data["created_at"])
        record.updated_at = datetime.fromisoformat(data["updated_at"])
        return record
