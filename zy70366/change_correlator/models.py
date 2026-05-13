"""
数据模型定义
"""

from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any
from datetime import datetime
import json
from enum import Enum


class ChangeType(Enum):
    DEPLOYMENT = "deployment"
    CONFIG_CHANGE = "config_change"
    SCALE = "scale"


class MetricType(Enum):
    ERROR_RATE = "error_rate"
    LATENCY = "latency"
    CPU = "cpu"
    MEMORY = "memory"
    DISK = "disk"
    NETWORK = "network"
    AVAILABILITY = "availability"


@dataclass
class Change:
    id: str
    type: ChangeType
    service: str
    instance: Optional[str]
    tenant: Optional[str]
    start_time: datetime
    end_time: Optional[datetime]
    description: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    excluded: bool = False
    exclude_reason: Optional[str] = None
    marked_cause: bool = False
    cause_remark: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["type"] = self.type.value
        data["start_time"] = self.start_time.isoformat()
        if self.end_time:
            data["end_time"] = self.end_time.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Change":
        data = data.copy()
        data["type"] = ChangeType(data["type"])
        data["start_time"] = datetime.fromisoformat(data["start_time"])
        if data.get("end_time"):
            data["end_time"] = datetime.fromisoformat(data["end_time"])
        return cls(**data)


@dataclass
class Alert:
    id: str
    service: str
    instance: Optional[str]
    tenant: Optional[str]
    metric_type: MetricType
    start_time: datetime
    end_time: Optional[datetime]
    severity: str
    description: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    deduplicated_from: Optional[List[str]] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["metric_type"] = self.metric_type.value
        data["start_time"] = self.start_time.isoformat()
        if self.end_time:
            data["end_time"] = self.end_time.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Alert":
        data = data.copy()
        data["metric_type"] = MetricType(data["metric_type"])
        data["start_time"] = datetime.fromisoformat(data["start_time"])
        if data.get("end_time"):
            data["end_time"] = datetime.fromisoformat(data["end_time"])
        return cls(**data)


@dataclass
class ServiceAlias:
    canonical: str
    aliases: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ServiceAlias":
        return cls(**data)


@dataclass
class CorrelationScore:
    change_id: str
    alert_id: str
    total_score: float
    time_score: float
    time_reason: str
    service_score: float
    service_reason: str
    instance_score: float
    instance_reason: str
    tenant_score: float
    tenant_reason: str
    metric_score: float
    metric_reason: str
    time_window_minutes: int

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CorrelationScore":
        return cls(**data)


@dataclass
class CorrelationResult:
    change: Change
    alert: Alert
    score: CorrelationScore
    is_root_cause: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "change": self.change.to_dict(),
            "alert": self.alert.to_dict(),
            "score": self.score.to_dict(),
            "is_root_cause": self.is_root_cause,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CorrelationResult":
        return cls(
            change=Change.from_dict(data["change"]),
            alert=Alert.from_dict(data["alert"]),
            score=CorrelationScore.from_dict(data["score"]),
            is_root_cause=data.get("is_root_cause", False),
        )


@dataclass
class Report:
    generated_at: datetime
    changes: List[Change]
    alerts: List[Alert]
    correlations: List[CorrelationResult]
    excluded_changes: List[Change]
    marked_root_causes: List[Change]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "generated_at": self.generated_at.isoformat(),
            "changes": [c.to_dict() for c in self.changes],
            "alerts": [a.to_dict() for a in self.alerts],
            "correlations": [c.to_dict() for c in self.correlations],
            "excluded_changes": [c.to_dict() for c in self.excluded_changes],
            "marked_root_causes": [c.to_dict() for c in self.marked_root_causes],
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Report":
        return cls(
            generated_at=datetime.fromisoformat(data["generated_at"]),
            changes=[Change.from_dict(c) for c in data["changes"]],
            alerts=[Alert.from_dict(a) for a in data["alerts"]],
            correlations=[CorrelationResult.from_dict(c) for c in data["correlations"]],
            excluded_changes=[Change.from_dict(c) for c in data["excluded_changes"]],
            marked_root_causes=[Change.from_dict(c) for c in data["marked_root_causes"]],
        )
