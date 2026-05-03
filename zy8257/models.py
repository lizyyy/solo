from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any


@dataclass
class Deceased:
    deceased_id: str
    name: str
    gender: str
    birth_date: Optional[datetime] = None
    death_date: Optional[datetime] = None
    cause_of_death: str = ""
    contact_person: str = ""
    contact_phone: str = ""
    remarks: str = ""
    is_resolved: bool = False
    resolved_by: str = ""
    resolved_at: Optional[datetime] = None
    resolve_notes: str = ""


@dataclass
class ColdChamberLog:
    log_id: str
    chamber_id: str
    deceased_id: Optional[str] = None
    operation_type: str = ""
    temperature: Optional[float] = None
    timestamp: Optional[datetime] = None
    operator: str = ""
    remarks: str = ""


@dataclass
class HandoverRecord:
    handover_id: str
    deceased_id: str
    handover_type: str = ""
    from_chamber: Optional[str] = None
    to_chamber: Optional[str] = None
    from_person: str = ""
    to_person: str = ""
    handover_time: Optional[datetime] = None
    is_signed: bool = False
    signed_by: str = ""
    signed_at: Optional[datetime] = None
    remarks: str = ""


@dataclass
class Rule:
    rule_id: str
    rule_name: str
    rule_type: str
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    description: str = ""
    is_active: bool = True


@dataclass
class TimelineEvent:
    event_id: str
    deceased_id: str
    event_type: str
    timestamp: datetime
    chamber_id: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)
    source_record: Any = None


@dataclass
class Issue:
    issue_id: str
    issue_type: str
    severity: str
    deceased_id: Optional[str] = None
    chamber_id: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    description: str = ""
    is_resolved: bool = False
    resolved_by: str = ""
    resolved_at: Optional[datetime] = None
    resolve_notes: str = ""
    related_records: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class ChamberStatus:
    chamber_id: str
    current_occupant: Optional[str] = None
    current_start_time: Optional[datetime] = None
    temperature_history: List[Dict[str, Any]] = field(default_factory=list)
    occupancy_history: List[Dict[str, Any]] = field(default_factory=list)
    issues: List[Issue] = field(default_factory=list)


class IssueType:
    TEMPERATURE_OUT_OF_RANGE = "温度超窗"
    CHAMBER_OVERLAP = "同柜重叠占用"
    MISSING_SIGNATURE = "交接签收缺失"
    MIDNIGHT_MISALIGNMENT = "跨午夜归属错位"
    MISSING_FIELD = "字段缺失"
    DUPLICATE_HANDOVER = "重复交接"
    UNEXPECTED_OPERATION = "异常操作"


class Severity:
    CRITICAL = "严重"
    HIGH = "高"
    MEDIUM = "中"
    LOW = "低"
