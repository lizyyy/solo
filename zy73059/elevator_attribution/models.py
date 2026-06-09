from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class FaultStatus(str, Enum):
    PENDING = "待归因"
    ATTRIBUTED = "已归因"
    REVOKED = "已撤回"
    BLOCKED = "已拦截"


class ChangeType(str, Enum):
    CREATE = "创建"
    UPDATE_ATTRIBUTION = "修改归因"
    REVOKE = "撤回"
    REASSIGN = "重新分配"
    BLOCK = "拦截"


class BlockReason(str, Enum):
    SAMPLE_GAP = "采样断档"
    SENSOR_ABNORMAL = "传感器异常"
    DATA_MISMATCH = "数据矛盾"
    REVOKED_PENDING = "存在待确认撤回"


@dataclass
class AuditLog:
    change_id: str
    fault_id: str
    change_type: ChangeType
    operator: str
    timestamp: str
    before: Optional[Dict[str, Any]] = None
    after: Optional[Dict[str, Any]] = None
    change_note: str = ""

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["change_type"] = self.change_type.value
        return d


@dataclass
class SensorLog:
    log_id: str
    fault_id: str
    ts: str
    sensor_type: str
    sensor_value: float
    is_revoked: bool = False
    revoke_note: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class AttributionChain:
    chain_id: str
    fault_id: str
    summary_id: str
    detail_id: str
    raw_log_ids: List[str]
    change_ids: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class FaultRecord:
    fault_id: str
    elevator_id: str
    occurred_at: str
    fault_code: str
    fault_desc: str
    status: FaultStatus
    root_cause: str = ""
    attributor: str = ""
    attributed_at: str = ""
    block_reason: Optional[BlockReason] = None
    block_detail: str = ""
    attribution_confidence: float = 0.0
    audit_logs: List[AuditLog] = field(default_factory=list)
    sensor_logs: List[SensorLog] = field(default_factory=list)
    chains: List[AttributionChain] = field(default_factory=list)

    def to_dict(self, include_chain: bool = True) -> Dict[str, Any]:
        d = {
            "fault_id": self.fault_id,
            "elevator_id": self.elevator_id,
            "occurred_at": self.occurred_at,
            "fault_code": self.fault_code,
            "fault_desc": self.fault_desc,
            "status": self.status.value,
            "root_cause": self.root_cause,
            "attributor": self.attributor,
            "attributed_at": self.attributed_at,
            "block_reason": self.block_reason.value if self.block_reason else None,
            "block_detail": self.block_detail,
            "attribution_confidence": self.attribution_confidence,
            "audit_count": len(self.audit_logs),
            "sensor_log_count": len(self.sensor_logs),
        }
        if include_chain:
            d["audit_logs"] = [a.to_dict() for a in self.audit_logs]
            d["sensor_logs"] = [s.to_dict() for s in self.sensor_logs]
            d["chains"] = [c.to_dict() for c in self.chains]
        return d


@dataclass
class FilterCriteria:
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    elevator_ids: Optional[List[str]] = None
    status_list: Optional[List[FaultStatus]] = None
    fault_codes: Optional[List[str]] = None
    min_confidence: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "start_date": self.start_date,
            "end_date": self.end_date,
            "elevator_ids": self.elevator_ids,
            "status_list": [s.value for s in self.status_list] if self.status_list else None,
            "fault_codes": self.fault_codes,
            "min_confidence": self.min_confidence,
        }


@dataclass
class ExportResult:
    export_ts: str
    total_count: int
    filter_criteria: Dict[str, Any]
    records: List[Dict[str, Any]]
    summary_stats: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
