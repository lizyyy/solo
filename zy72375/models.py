from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any
from enum import Enum
import uuid
import hashlib
from datetime import datetime


class ProcessingStatus(str, Enum):
    PENDING = "待处理"
    IMPORTED = "已导入"
    PHOTO_REVIEWED = "照片已复核"
    TEMP_MIXED = "温度单位混用待复核"
    COACH_REVIEWED = "教练已复核"
    REPORT_UPDATED = "交接报告已更新"
    CONFIRMED = "已确认"


class ChangeType(str, Enum):
    IMPORT = "导入"
    MANUAL_EDIT = "人工改动"
    PHOTO_ATTACH = "工况照片关联"
    TEMP_CORRECTION = "温度单位修正"
    ROLLBACK = "回滚"
    COACH_APPROVAL = "教练复核"
    REPORT_UPDATE = "交接报告更新"


@dataclass
class SensorRecord:
    sensor_id: str
    original_line_number: int
    raw_data: Dict[str, Any]
    source_file: str
    import_batch_id: str
    temperature_value: Optional[float] = None
    temperature_unit: Optional[str] = None
    uniform_zone_flag: Optional[bool] = None
    processing_status: ProcessingStatus = ProcessingStatus.PENDING
    manual_edits: List[Dict[str, Any]] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def get_unique_key(self) -> str:
        return hashlib.sha256(
            f"{self.sensor_id}|{self.original_line_number}|{self.source_file}".encode()
        ).hexdigest()

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["processing_status"] = self.processing_status.value
        return data


@dataclass
class PhotoRecord:
    photo_id: str
    scene_description: str
    source_file: str
    upload_time: str
    related_sensor_ids: List[str] = field(default_factory=list)
    reviewer: Optional[str] = None
    review_notes: Optional[str] = None
    is_late_arrival: bool = False
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class HistoryEntry:
    entry_id: str
    uniform_zone_id: str
    change_type: ChangeType
    before_value: Optional[Dict[str, Any]] = None
    after_value: Optional[Dict[str, Any]] = None
    operator: Optional[str] = None
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    reason: Optional[str] = None
    evidence_ref: Optional[str] = None
    command_used: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["change_type"] = self.change_type.value
        return data


@dataclass
class UniformZoneRecord:
    uniform_zone_id: str
    sensor_id: str
    sensor_record_key: str
    original_line_number: int
    source_file: str
    temperature_value: Optional[float] = None
    temperature_unit: Optional[str] = None
    uniform_zone_flag: Optional[bool] = None
    processing_status: ProcessingStatus = ProcessingStatus.PENDING
    related_photo_ids: List[str] = field(default_factory=list)
    review_notes: Optional[str] = None
    manual_annotation: Optional[str] = None
    has_mixed_temp_units: bool = False
    coach_review_required: bool = False
    history_ids: List[str] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    last_updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    import_batch_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["processing_status"] = self.processing_status.value
        return data


@dataclass
class AuditLog:
    command: str
    parameters: Dict[str, Any]
    result_summary: str
    log_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    operator: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class BoundaryRule:
    rule_id: str
    description: str
    rule_type: str
    condition: str
    action: str
    rollback_action: str
    is_active: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
