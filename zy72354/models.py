from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from enum import Enum
import hashlib
import json


class ErrorStatus(str, Enum):
    PENDING_REVIEW = "待质检员复核"
    NORMAL = "正常"
    ABNORMAL = "异常"
    MODIFIED = "已修改"
    ROLLED_BACK = "已回滚"


class DataSource(str, Enum):
    MANUAL_NOTE = "手写巡检备注"
    SENSOR = "传感器自动采集"


@dataclass
class SafetyThreshold:
    azimuth_max: float = 2.0
    elevation_max: float = 1.5
    tracking_accuracy_min: float = 95.0
    update_time: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["update_time"] = self.update_time.isoformat()
        return d


@dataclass
class ManualInspectionNote:
    note_id: str
    inspection_date: str
    inspector: str
    bracket_id: str
    azimuth_error: Optional[float] = None
    elevation_error: Optional[float] = None
    sampling_start_time: Optional[datetime] = None
    sampling_end_time: Optional[datetime] = None
    sampling_duration_minutes: Optional[float] = None
    tracking_accuracy: Optional[float] = None
    raw_content: str = ""
    import_time: datetime = field(default_factory=datetime.now)
    import_batch_id: str = ""
    source_file_hash: str = ""
    version: int = 1

    def calculate_sampling_duration(self) -> Optional[float]:
        if self.sampling_start_time and self.sampling_end_time:
            delta = self.sampling_end_time - self.sampling_start_time
            self.sampling_duration_minutes = delta.total_seconds() / 60.0
            return self.sampling_duration_minutes
        return None

    def content_hash(self) -> str:
        content = json.dumps({
            "note_id": self.note_id,
            "inspection_date": self.inspection_date,
            "bracket_id": self.bracket_id,
            "azimuth_error": self.azimuth_error,
            "elevation_error": self.elevation_error,
            "sampling_start_time": self.sampling_start_time.isoformat() if self.sampling_start_time else None,
            "sampling_end_time": self.sampling_end_time.isoformat() if self.sampling_end_time else None,
            "tracking_accuracy": self.tracking_accuracy,
            "raw_content": self.raw_content,
        }, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        if self.sampling_start_time:
            d["sampling_start_time"] = self.sampling_start_time.isoformat()
        if self.sampling_end_time:
            d["sampling_end_time"] = self.sampling_end_time.isoformat()
        d["import_time"] = self.import_time.isoformat()
        return d


@dataclass
class SolarTrackingBracketError:
    error_id: str
    bracket_id: str
    note_id: str
    inspection_date: str
    azimuth_error: Optional[float] = None
    elevation_error: Optional[float] = None
    tracking_accuracy: Optional[float] = None
    sampling_start_time: Optional[datetime] = None
    sampling_end_time: Optional[datetime] = None
    sampling_duration_minutes: Optional[float] = None
    status: ErrorStatus = ErrorStatus.PENDING_REVIEW
    boundary_violations: List[str] = field(default_factory=list)
    human_readable_issues: List[str] = field(default_factory=list)
    data_source: DataSource = DataSource.MANUAL_NOTE
    review_by: Optional[str] = None
    review_time: Optional[datetime] = None
    review_comment: str = ""
    import_batch_id: str = ""
    source_note_hash: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    version: int = 1

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["status"] = self.status.value
        d["data_source"] = self.data_source.value
        if self.sampling_start_time:
            d["sampling_start_time"] = self.sampling_start_time.isoformat()
        if self.sampling_end_time:
            d["sampling_end_time"] = self.sampling_end_time.isoformat()
        if self.review_time:
            d["review_time"] = self.review_time.isoformat()
        d["created_at"] = self.created_at.isoformat()
        d["updated_at"] = self.updated_at.isoformat()
        return d


@dataclass
class VersionHistory:
    error_id: str
    version: int
    before_data: Dict[str, Any]
    after_data: Dict[str, Any]
    modified_by: str
    modified_time: datetime = field(default_factory=datetime.now)
    modification_reason: str = ""
    fields_changed: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["modified_time"] = self.modified_time.isoformat()
        return d


@dataclass
class ReviewLink:
    error_id: str
    target_type: str
    target_id: str
    target_field: str
    context: str
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["created_at"] = self.created_at.isoformat()
        return d
