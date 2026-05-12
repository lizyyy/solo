from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional
from enum import Enum
from datetime import datetime
import json


class SampleStatus(Enum):
    VALID = "valid"
    BAD = "bad"
    MISSING_HEADERS = "missing_headers"
    DESENSITIZATION_FAILED = "desensitization_failed"


class DiffType(Enum):
    NEW_FIELD = "new_field"
    MISSING_FIELD = "missing_field"
    VALUE_CHANGED = "value_changed"
    ORDER_CHANGED = "order_changed"
    ERROR_MESSAGE = "error_message"


@dataclass
class RequestSample:
    id: str
    group: str
    method: str
    url: str
    headers: Dict[str, str]
    body: Any
    timestamp: datetime
    status: SampleStatus = SampleStatus.VALID
    original_id: Optional[str] = None
    desensitized: bool = False
    side_effects: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["timestamp"] = self.timestamp.isoformat()
        data["status"] = self.status.value
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RequestSample":
        ts_str = data["timestamp"].replace("Z", "+00:00")
        data["timestamp"] = datetime.fromisoformat(ts_str)
        data["status"] = SampleStatus(data["status"])
        return cls(**data)


@dataclass
class ReplayResult:
    sample_id: str
    source: str
    status_code: int
    headers: Dict[str, str]
    body: Any
    response_time_ms: float
    side_effects: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None


@dataclass
class FieldDiff:
    path: str
    diff_type: DiffType
    old_value: Any
    new_value: Any
    ignored: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "path": self.path,
            "diff_type": self.diff_type.value,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "ignored": self.ignored,
        }


@dataclass
class ComparisonResult:
    sample_id: str
    sample_group: str
    diffs: List[FieldDiff]
    severity_score: float
    approved: bool = False
    approval_record: Optional[str] = None

    @property
    def has_diff(self) -> bool:
        return any(not d.ignored for d in self.diffs)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sample_id": self.sample_id,
            "sample_group": self.sample_group,
            "diffs": [d.to_dict() for d in self.diffs],
            "severity_score": self.severity_score,
            "approved": self.approved,
            "approval_record": self.approval_record,
        }


@dataclass
class Approval:
    approval_id: str
    sample_id: str
    diffs_hash: str
    reason: str
    approver: str
    timestamp: datetime

    def to_dict(self) -> Dict[str, Any]:
        return {
            "approval_id": self.approval_id,
            "sample_id": self.sample_id,
            "diffs_hash": self.diffs_hash,
            "reason": self.reason,
            "approver": self.approver,
            "timestamp": self.timestamp.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Approval":
        ts_str = data["timestamp"].replace("Z", "+00:00")
        data["timestamp"] = datetime.fromisoformat(ts_str)
        return cls(**data)
