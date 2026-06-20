from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Any
from datetime import datetime
from enum import Enum
import hashlib
import uuid


def stable_record_id(source_file: str, source_row: int, pet_id: str,
                     raw_weight_value: str, measure_date_str: str = "") -> str:
    parts = [
        str(source_file or ""),
        str(source_row or 0),
        str(pet_id or ""),
        str(raw_weight_value or ""),
        str(measure_date_str or ""),
    ]
    raw = "|".join(parts)
    return "rec_" + hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


def stable_anomaly_id(anomaly_type: str, pet_id: str, weight_curve_ref: str,
                      involved_record_ids: List[str], calc_formula: str) -> str:
    parts = [
        str(anomaly_type or ""),
        str(pet_id or ""),
        str(weight_curve_ref or ""),
        ",".join(sorted(involved_record_ids or [])),
        str(calc_formula or ""),
    ]
    raw = "|".join(parts)
    return "anom_" + hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


def stable_change_id(anomaly_id: str, changed_at_str: str, action: str, changed_by: str) -> str:
    parts = [str(anomaly_id or ""), str(changed_at_str or ""), str(action or ""), str(changed_by or "")]
    raw = "|".join(parts)
    return "chg_" + hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


class ProcessingStatus(str, Enum):
    PENDING = "待处理"
    UNIT_CONFIRM_REQUIRED = "需确认单位"
    DATA_CONFLICT = "数据冲突待核"
    FIELD_MISSING = "字段缺失"
    CONFIRMED = "已确认"
    RESOLVED = "已解决"
    REVISED = "已改判"
    ARCHIVED = "已归档"


class AnomalyType(str, Enum):
    UNIT_MIXED = "单位混写"
    WEIGHT_JUMP = "体重骤变"
    DATA_CONFLICT = "新旧记录冲突"
    FIELD_MISSING = "必填字段缺失"
    OUTLIER = "离群值"
    DUPLICATE_RECORD = "重复记录"


@dataclass
class WeightRecord:
    record_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    pet_id: str = ""
    pet_name: str = ""
    measure_date: Optional[datetime] = None
    weight_kg: Optional[float] = None
    weight_unit: str = ""
    raw_weight_value: str = ""
    raw_unit_value: str = ""
    data_source: str = ""
    source_file: str = ""
    source_row: int = 0
    remark: str = ""
    processing_status: ProcessingStatus = ProcessingStatus.PENDING
    unit_normalized: bool = False
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    raw_fields: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict:
        d = asdict(self)
        d["measure_date"] = self.measure_date.isoformat() if self.measure_date else None
        d["processing_status"] = self.processing_status.value
        d["created_at"] = self.created_at.isoformat()
        d["updated_at"] = self.updated_at.isoformat()
        return d

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> "WeightRecord":
        d = dict(data)
        for k in ("measure_date", "created_at", "updated_at"):
            if isinstance(d.get(k), str):
                try:
                    d[k] = datetime.fromisoformat(d[k])
                except (ValueError, TypeError):
                    d[k] = None
        if isinstance(d.get("processing_status"), str):
            try:
                d["processing_status"] = ProcessingStatus(d["processing_status"])
            except ValueError:
                d["processing_status"] = ProcessingStatus.PENDING
        return WeightRecord(**d)

    def ensure_stable_id(self):
        if not self.record_id or not self.record_id.startswith("rec_"):
            date_str = self.measure_date.isoformat() if self.measure_date else ""
            self.record_id = stable_record_id(
                self.source_file, self.source_row, self.pet_id,
                self.raw_weight_value, date_str,
            )


@dataclass
class AnomalyRecord:
    anomaly_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    anomaly_type: AnomalyType = AnomalyType.DATA_CONFLICT
    severity: str = "high"
    pet_id: str = ""
    pet_name: str = ""
    description: str = ""
    block_reason: str = ""
    next_step: str = ""
    responsible_role: str = ""
    responsible_contact: str = ""
    involved_record_ids: List[str] = field(default_factory=list)
    weight_curve_ref: str = ""
    calc_formula: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    resolved_at: Optional[datetime] = None
    resolved_by: str = ""
    status: ProcessingStatus = ProcessingStatus.PENDING
    extra: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict:
        d = asdict(self)
        d["anomaly_type"] = self.anomaly_type.value
        d["status"] = self.status.value
        d["created_at"] = self.created_at.isoformat()
        d["updated_at"] = self.updated_at.isoformat()
        d["resolved_at"] = self.resolved_at.isoformat() if self.resolved_at else None
        return d

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> "AnomalyRecord":
        d = dict(data)
        for k in ("created_at", "updated_at", "resolved_at"):
            if isinstance(d.get(k), str):
                try:
                    d[k] = datetime.fromisoformat(d[k])
                except (ValueError, TypeError):
                    d[k] = None
        if isinstance(d.get("anomaly_type"), str):
            try:
                d["anomaly_type"] = AnomalyType(d["anomaly_type"])
            except ValueError:
                d["anomaly_type"] = AnomalyType.DATA_CONFLICT
        if isinstance(d.get("status"), str):
            try:
                d["status"] = ProcessingStatus(d["status"])
            except ValueError:
                d["status"] = ProcessingStatus.PENDING
        return AnomalyRecord(**d)

    def ensure_stable_id(self):
        if not self.anomaly_id or not self.anomaly_id.startswith("anom_"):
            self.anomaly_id = stable_anomaly_id(
                self.anomaly_type.value if hasattr(self.anomaly_type, "value") else str(self.anomaly_type),
                self.pet_id, self.weight_curve_ref,
                self.involved_record_ids, self.calc_formula,
            )


@dataclass
class HistoryChange:
    change_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    anomaly_id: str = ""
    record_id: str = ""
    changed_by: str = ""
    changed_at: datetime = field(default_factory=datetime.now)
    action: str = ""
    old_values: Dict[str, Any] = field(default_factory=dict)
    new_values: Dict[str, Any] = field(default_factory=dict)
    revision_reason: str = ""
    old_remark: str = ""
    new_remark: str = ""
    previous_conclusion: str = ""
    new_conclusion: str = ""
    source_materials_ref: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        d = asdict(self)
        d["changed_at"] = self.changed_at.isoformat()
        return d

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> "HistoryChange":
        d = dict(data)
        if isinstance(d.get("changed_at"), str):
            try:
                d["changed_at"] = datetime.fromisoformat(d["changed_at"])
            except (ValueError, TypeError):
                d["changed_at"] = datetime.now()
        return HistoryChange(**d)

    def ensure_stable_id(self):
        if not self.change_id or not self.change_id.startswith("chg_"):
            self.change_id = stable_change_id(
                self.anomaly_id,
                self.changed_at.isoformat() if self.changed_at else "",
                self.action, self.changed_by,
            )


@dataclass
class WeightCurveSnapshot:
    pet_id: str = ""
    pet_name: str = ""
    points: List[Dict] = field(default_factory=list)
    trend: str = "stable"
    baseline_weight_kg: Optional[float] = None
    last_weight_kg: Optional[float] = None
    calc_note: str = ""
    generated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict:
        d = asdict(self)
        d["generated_at"] = self.generated_at.isoformat()
        return d
