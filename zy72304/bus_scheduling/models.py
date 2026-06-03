"""
数据模型模块

定义系统中所有核心数据结构，包括抽样记录、排班结果、计算明细、变更历史等。
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class NumberType(str, Enum):
    PERCENTAGE = "percentage"
    DECIMAL = "decimal"
    MIXED = "mixed"
    UNKNOWN = "unknown"


class IssueStatus(str, Enum):
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    MODIFIED = "modified"
    ROLLED_BACK = "rolled_back"


class WorkflowStep(str, Enum):
    STEP1_IMPORT = "step1_import"
    STEP2_PARAM_DEBUG = "step2_param_debug"
    STEP3_CALC_UPDATE = "step3_calc_update"
    COMPLETED = "completed"


@dataclass
class MixedNumberIssue:
    """
    百分数和小数混合问题记录

    当抽样数据中同时出现百分数和小数时，记录该问题供活动负责人复核。
    """
    issue_id: str
    record_id: str
    field_name: str
    original_value: str
    detected_type: NumberType
    suggested_value: Optional[float] = None
    status: IssueStatus = IssueStatus.PENDING_REVIEW
    retain_reason: Optional[str] = None
    reviewer: Optional[str] = None
    review_time: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "issue_id": self.issue_id,
            "record_id": self.record_id,
            "field_name": self.field_name,
            "original_value": self.original_value,
            "detected_type": self.detected_type.value,
            "suggested_value": self.suggested_value,
            "status": self.status.value,
            "retain_reason": self.retain_reason,
            "reviewer": self.reviewer,
            "review_time": self.review_time.isoformat() if self.review_time else None,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class SamplingRecord:
    """
    抽样记录

    存储从抽样名单导入的原始数据。
    """
    record_id: str
    route_code: str
    route_name: str
    passenger_count: float
    departure_time: str
    original_data: Dict[str, Any]
    source_file: str
    import_batch_id: str
    is_duplicate: bool = False
    issues: List[MixedNumberIssue] = field(default_factory=list)
    remark: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "route_code": self.route_code,
            "route_name": self.route_name,
            "passenger_count": self.passenger_count,
            "departure_time": self.departure_time,
            "original_data": self.original_data,
            "source_file": self.source_file,
            "import_batch_id": self.import_batch_id,
            "is_duplicate": self.is_duplicate,
            "issues": [issue.to_dict() for issue in self.issues],
            "remark": self.remark,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


@dataclass
class ChangeHistory:
    """
    变更历史记录

    追踪每条记录的所有变更，包括备注修改、数值调整等。
    """
    history_id: str
    record_id: str
    field_name: str
    old_value: Optional[str]
    new_value: Optional[str]
    operator: str
    change_time: datetime = field(default_factory=datetime.now)
    change_reason: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "history_id": self.history_id,
            "record_id": self.record_id,
            "field_name": self.field_name,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "operator": self.operator,
            "change_time": self.change_time.isoformat(),
            "change_reason": self.change_reason,
        }


@dataclass
class CalculationDetail:
    """
    计算明细

    记录排班计算的详细过程，支持下钻查看每条数据。
    """
    detail_id: str
    record_id: str
    route_code: str
    input_params: Dict[str, Any]
    calculation_steps: List[Dict[str, Any]]
    result_value: float
    issues_involved: List[str] = field(default_factory=list)
    retain_reason: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "detail_id": self.detail_id,
            "record_id": self.record_id,
            "route_code": self.route_code,
            "input_params": self.input_params,
            "calculation_steps": self.calculation_steps,
            "result_value": self.result_value,
            "issues_involved": self.issues_involved,
            "retain_reason": self.retain_reason,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class SchedulingResult:
    """
    排班结果

    存储整数规划排班的最终结果。
    """
    result_id: str
    batch_id: str
    bus_count: int
    route_allocations: Dict[str, int]
    total_cost: float
    calculation_details: List[CalculationDetail] = field(default_factory=list)
    issues_found: List[MixedNumberIssue] = field(default_factory=list)
    workflow_step: WorkflowStep = WorkflowStep.STEP1_IMPORT
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "result_id": self.result_id,
            "batch_id": self.batch_id,
            "bus_count": self.bus_count,
            "route_allocations": self.route_allocations,
            "total_cost": self.total_cost,
            "calculation_details": [d.to_dict() for d in self.calculation_details],
            "issues_found": [i.to_dict() for i in self.issues_found],
            "workflow_step": self.workflow_step.value,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class ParameterConfig:
    """
    参数配置

    存储排班计算的参数配置。
    """
    config_id: str
    bus_capacity: int = 45
    cost_per_bus: float = 500.0
    max_buses_per_route: int = 10
    min_buses_per_route: int = 1
    peak_hours_multiplier: float = 1.5
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "config_id": self.config_id,
            "bus_capacity": self.bus_capacity,
            "cost_per_bus": self.cost_per_bus,
            "max_buses_per_route": self.max_buses_per_route,
            "min_buses_per_route": self.min_buses_per_route,
            "peak_hours_multiplier": self.peak_hours_multiplier,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
