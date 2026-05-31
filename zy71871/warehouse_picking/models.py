from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
import hashlib


class ValidationStatus(Enum):
    PENDING = "待确认"
    NORMAL = "正常"
    SUSPICIOUS = "存疑"
    INVALID = "无效"


class IssueType(Enum):
    DRIFT = "结果漂移"
    CONSTRAINT_OVERRIDE = "约束被覆盖"
    UNIT_MISMATCH = "单位混用"
    DATA_INCONSISTENCY = "数据不一致"


@dataclass
class ValidationIssue:
    issue_type: IssueType
    description: str
    severity: str
    evidence: Dict[str, Any] = field(default_factory=dict)
    suggestion: str = ""


@dataclass
class PickingResult:
    record_id: str
    order_no: str
    sku_code: str
    sku_name: str
    pick_qty: float
    unit: str
    pick_location: str
    picker: str
    pick_time: datetime
    run_id: str
    batch_no: str
    version: int = 1
    status: ValidationStatus = ValidationStatus.PENDING
    issues: list = field(default_factory=list)
    validation_notes: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    extra: Dict[str, Any] = field(default_factory=dict)

    def generate_fingerprint(self) -> str:
        content = (
            f"{self.order_no}|{self.sku_code}|{self.pick_qty}|"
            f"{self.unit}|{self.pick_location}|{self.run_id}"
        )
        return hashlib.md5(content.encode("utf-8")).hexdigest()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "order_no": self.order_no,
            "sku_code": self.sku_code,
            "sku_name": self.sku_name,
            "pick_qty": self.pick_qty,
            "unit": self.unit,
            "pick_location": self.pick_location,
            "picker": self.picker,
            "pick_time": self.pick_time.isoformat() if self.pick_time else None,
            "run_id": self.run_id,
            "batch_no": self.batch_no,
            "version": self.version,
            "status": self.status.value,
            "issues": [
                {
                    "type": i.issue_type.value,
                    "description": i.description,
                    "severity": i.severity,
                    "evidence": i.evidence,
                    "suggestion": i.suggestion,
                }
                for i in self.issues
            ],
            "validation_notes": self.validation_notes,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "extra": self.extra,
        }


@dataclass
class ChangeLog:
    log_id: str
    record_id: str
    action: str
    previous_version: Optional[int]
    new_version: Optional[int]
    operator: str
    reason: str
    timestamp: datetime = field(default_factory=datetime.now)
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "log_id": self.log_id,
            "record_id": self.record_id,
            "action": self.action,
            "previous_version": self.previous_version,
            "new_version": self.new_version,
            "operator": self.operator,
            "reason": self.reason,
            "timestamp": self.timestamp.isoformat(),
            "details": self.details,
        }
