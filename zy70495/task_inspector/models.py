from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
import uuid


class RiskType(Enum):
    OLD_VERSION_OVERWRITES_NEW = "旧版本覆盖新版本"
    EXPIRED_RECORD = "过期记录"
    DATA_INCONSISTENCY = "数据不一致"
    UNKNOWN = "未知风险"


class OperationType(Enum):
    CLEAN = "清理"
    ROLLBACK = "回滚"
    INSPECT = "巡检"


class OperationStatus(Enum):
    PENDING = "待确认"
    CONFIRMED = "已确认"
    CANCELLED = "已取消"
    EXECUTED = "已执行"
    FAILED = "执行失败"


@dataclass
class DutyRecord:
    record_id: str
    date: str
    engineer: str
    content: str
    version: int
    last_updated: datetime
    created_at: datetime
    is_expired: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "date": self.date,
            "engineer": self.engineer,
            "content": self.content,
            "version": self.version,
            "last_updated": self.last_updated.isoformat(),
            "created_at": self.created_at.isoformat(),
            "is_expired": self.is_expired,
            "metadata": self.metadata
        }


@dataclass
class CandidateItem:
    record_id: str
    risk_type: RiskType
    description: str
    suggestion: str
    current_version: int
    detected_version: Optional[int] = None
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "risk_type": self.risk_type.value,
            "description": self.description,
            "suggestion": self.suggestion,
            "current_version": self.current_version,
            "detected_version": self.detected_version,
            "details": self.details
        }


@dataclass
class InspectionBatch:
    batch_id: str
    operator: str
    operation_type: OperationType
    created_at: datetime
    status: OperationStatus
    candidates: List[CandidateItem] = field(default_factory=list)
    executed_at: Optional[datetime] = None
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "batch_id": self.batch_id,
            "operator": self.operator,
            "operation_type": self.operation_type.value,
            "created_at": self.created_at.isoformat(),
            "status": self.status.value,
            "candidates": [c.to_dict() for c in self.candidates],
            "executed_at": self.executed_at.isoformat() if self.executed_at else None,
            "notes": self.notes
        }


@dataclass
class HistoryRecord:
    history_id: str
    batch_id: str
    record_id: str
    operator: str
    risk_type: RiskType
    operation_type: OperationType
    executed_at: datetime
    before_state: Dict[str, Any]
    after_state: Dict[str, Any]
    result: str
    is_anomaly: bool = False
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "history_id": self.history_id,
            "batch_id": self.batch_id,
            "record_id": self.record_id,
            "operator": self.operator,
            "risk_type": self.risk_type.value,
            "operation_type": self.operation_type.value,
            "executed_at": self.executed_at.isoformat(),
            "before_state": self.before_state,
            "after_state": self.after_state,
            "result": self.result,
            "is_anomaly": self.is_anomaly,
            "details": self.details
        }


def generate_id() -> str:
    return str(uuid.uuid4())[:8]
