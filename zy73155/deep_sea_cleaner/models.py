from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime


class AnomalyType(str, Enum):
    DUPLICATE_BOTTLE = "duplicate_bottle"
    MISSING_VALUE = "missing_value"
    LAT_LON_FORMAT = "lat_lon_format"
    UNIT_MISMATCH = "unit_mismatch"
    FORMULA_ERROR = "formula_error"
    THRESHOLD_OUTLIER = "threshold_outlier"
    INVALID_VALUE = "invalid_value"


class FailReason(str, Enum):
    FORMULA = "formula"
    UNIT = "unit"
    THRESHOLD = "threshold"
    FORMAT = "format"


class ReviewStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    MANUAL_OVERRIDDEN = "manual_overridden"


@dataclass
class RawSampleRecord:
    record_id: str
    station: str
    bottle_id: str
    depth_m: Optional[float] = None
    depth_raw: Optional[str] = None
    temperature: Optional[float] = None
    temperature_unit: Optional[str] = None
    salinity: Optional[float] = None
    salinity_unit: Optional[str] = None
    latitude_raw: Optional[str] = None
    longitude_raw: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    sample_time: Optional[str] = None
    notes: Optional[str] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CleanAnomaly:
    anomaly_type: AnomalyType
    field_name: Optional[str] = None
    message: str = ""
    detail: Dict[str, Any] = field(default_factory=dict)
    fail_reason: Optional[FailReason] = None


@dataclass
class ManualReviewRecord:
    review_id: str
    record_id: str
    reviewer: str
    review_time: datetime
    status: ReviewStatus
    fail_reason: FailReason
    original_value: Optional[str] = None
    overridden_value: Optional[str] = None
    justification: str = ""
    source_note: str = ""


@dataclass
class CleanedRecord:
    record_id: str
    station: str
    bottle_id: str
    depth_m: Optional[float] = None
    temperature_c: Optional[float] = None
    salinity_psu: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    sample_time: Optional[str] = None
    anomalies: List[CleanAnomaly] = field(default_factory=list)
    review: Optional[ManualReviewRecord] = None
    is_valid: bool = True
    raw_ref: Optional[RawSampleRecord] = None

    @property
    def has_anomaly(self) -> bool:
        return len(self.anomalies) > 0


@dataclass
class CleanSummary:
    total_records: int = 0
    valid_records: int = 0
    anomaly_records: int = 0
    anomaly_by_type: Dict[str, int] = field(default_factory=dict)
    duplicate_bottles: List[Dict[str, Any]] = field(default_factory=list)
    fail_reason_counts: Dict[str, int] = field(default_factory=dict)
    manual_review_pending: int = 0
    manual_review_overridden: int = 0
    run_time: Optional[str] = None
    batch_id: str = ""
