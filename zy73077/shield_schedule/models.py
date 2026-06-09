from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Any
from datetime import datetime
import uuid
import json
import os


def _now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _uid():
    return uuid.uuid4().hex[:12]


@dataclass
class Anomaly:
    anomaly_id: str = field(default_factory=_uid)
    record_id: str = ""
    anomaly_type: str = ""
    description: str = ""
    severity: str = "warning"
    resolved: bool = False
    resolved_note: str = ""
    created_at: str = field(default_factory=_now)


@dataclass
class ScheduleRecord:
    record_id: str = field(default_factory=_uid)
    part_id: str = ""
    part_name: str = ""
    category: str = ""
    scheduled_date: str = ""
    quantity: int = 0
    status: str = "待安排"
    source: str = ""
    source_fields: Dict[str, Any] = field(default_factory=dict)
    field_mapping_log: List[Dict[str, str]] = field(default_factory=list)
    photo_url: str = ""
    photo_time: str = ""
    anomalies: List[Anomaly] = field(default_factory=list)
    audit_log: List[Dict[str, Any]] = field(default_factory=list)
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)

    def add_anomaly(self, atype: str, desc: str, severity="warning"):
        a = Anomaly(record_id=self.record_id, anomaly_type=atype, description=desc, severity=severity)
        self.anomalies.append(a)
        self.updated_at = _now()
        return a

    def add_audit(self, field: str, old_val: Any, new_val: Any, operator: str, reason: str):
        entry = {
            "audit_id": _uid(),
            "record_id": self.record_id,
            "field": field,
            "old_value": old_val,
            "new_value": new_val,
            "operator": operator,
            "reason": reason,
            "timestamp": _now(),
        }
        self.audit_log.append(entry)
        self.updated_at = _now()
        return entry

    def add_field_mapping(self, raw_field: str, mapped_to: str):
        self.field_mapping_log.append({"raw": raw_field, "mapped": mapped_to, "at": _now()})


@dataclass
class ParamVersion:
    version_id: str = field(default_factory=_uid)
    version_name: str = ""
    created_by: str = ""
    created_at: str = field(default_factory=_now)
    params: Dict[str, Any] = field(default_factory=dict)
    note: str = ""
    record_count: int = 0
    anomaly_count: int = 0


@dataclass
class RunDiff:
    diff_id: str = field(default_factory=_uid)
    base_version: str = ""
    compare_version: str = ""
    created_at: str = field(default_factory=_now)
    param_changes: List[Dict[str, Any]] = field(default_factory=list)
    record_changes: List[Dict[str, Any]] = field(default_factory=list)
    summary: Dict[str, int] = field(default_factory=dict)
