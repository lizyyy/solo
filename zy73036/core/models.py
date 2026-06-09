from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Any
from datetime import datetime
from enum import Enum
import uuid


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
