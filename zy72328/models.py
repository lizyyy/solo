from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class SampleStatus(Enum):
    NORMAL = "正常"
    BOUNDARY = "边界值"
    ABNORMAL = "异常"
    PENDING_REVIEW = "待任课老师复核"
    CONFIRMED = "吴老师确认"
    REJECTED = "吴老师驳回"


class ImportSource(Enum):
    SAMPLE_LIST = "抽样名单"
    PARAMETER_TABLE = "参数调试表"


class ConflictType(Enum):
    THRESHOLD_MISMATCH = "阈值判断不一致"
    STATUS_MISMATCH = "状态标记不一致"
    DATA_MISMATCH = "数据值不一致"


@dataclass
class SampleRecord:
    sample_id: str
    equation_param: float
    threshold: float
    root_value: Optional[float] = None
    status: SampleStatus = SampleStatus.NORMAL
    source: Optional[ImportSource] = None
    import_time: Optional[datetime] = None
    reviewer: Optional[str] = None
    review_time: Optional[datetime] = None
    notes: Optional[str] = None
    is_boundary_case: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sample_id": self.sample_id,
            "equation_param": self.equation_param,
            "threshold": self.threshold,
            "root_value": self.root_value,
            "status": self.status.value,
            "source": self.source.value if self.source else None,
            "import_time": self.import_time.isoformat() if self.import_time else None,
            "reviewer": self.reviewer,
            "review_time": self.review_time.isoformat() if self.review_time else None,
            "notes": self.notes,
            "is_boundary_case": self.is_boundary_case,
        }


@dataclass
class ConflictEvidence:
    sample_id: str
    conflict_type: ConflictType
    sample_list_value: Any
    parameter_table_value: Any
    description: str
    resolved: bool = False
    resolution: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sample_id": self.sample_id,
            "conflict_type": self.conflict_type.value,
            "sample_list_value": self.sample_list_value,
            "parameter_table_value": self.parameter_table_value,
            "description": self.description,
            "resolved": self.resolved,
            "resolution": self.resolution,
        }


@dataclass
class HistoryRecord:
    operation: str
    operator: str
    timestamp: datetime
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "operation": self.operation,
            "operator": self.operator,
            "timestamp": self.timestamp.isoformat(),
            "details": self.details,
        }


@dataclass
class SelfCheckResult:
    check_name: str
    passed: bool
    message: str
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "check_name": self.check_name,
            "passed": self.passed,
            "message": self.message,
            "details": self.details,
        }


@dataclass
class AntiExample:
    sample_id: str
    description: str
    root_cause: str
    detected_time: datetime

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sample_id": self.sample_id,
            "description": self.description,
            "root_cause": self.root_cause,
            "detected_time": self.detected_time.isoformat(),
        }
