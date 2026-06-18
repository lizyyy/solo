from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
import json
import uuid


class TideUnit(str, Enum):
    METERS = "m"
    CENTIMETERS = "cm"
    FEET = "ft"
    UNKNOWN = "unknown"


class CoordinateFormat(str, Enum):
    DECIMAL = "decimal"
    DMS = "dms"
    DDM = "ddm"
    UNKNOWN = "unknown"


class AnnotationStatus(str, Enum):
    DRAFT = "draft"
    PROCESSED = "processed"
    REPROCESSED = "reprocessed"
    EXCEPTION = "exception"


@dataclass
class RawBuoyLog:
    log_id: str
    raw_text: str
    raw_latitude: str
    raw_longitude: str
    raw_tide_value: str
    raw_tide_unit: str
    timestamp: str
    source_file: str
    line_number: int
    parsed_at: datetime = field(default_factory=datetime.now)
    parse_warnings: List[str] = field(default_factory=list)


@dataclass
class NormalizedCoordinates:
    latitude: float
    longitude: float
    original_format: CoordinateFormat
    raw_latitude: str
    raw_longitude: str
    parse_notes: List[str] = field(default_factory=list)


@dataclass
class NormalizedTide:
    value_meters: float
    original_value: str
    original_unit: TideUnit
    original_unit_raw: str
    normalize_notes: List[str] = field(default_factory=list)


@dataclass
class BuoyRecord:
    record_id: str
    raw_log: RawBuoyLog
    coordinates: Optional[NormalizedCoordinates]
    tide: Optional[NormalizedTide]
    parse_errors: List[str] = field(default_factory=list)
    is_valid: bool = True


@dataclass
class TideStationAnnotation:
    annotation_id: str
    batch_id: str
    station_name: str
    buoy_record: BuoyRecord
    scene_annotation: str
    side_note: str
    csv_row: Dict[str, str]
    status: AnnotationStatus
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    remarks: List[str] = field(default_factory=list)
    raw_trace: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RemarkDelta:
    field_changed: str
    old_value: Any
    new_value: Any
    judgment_impact: str


@dataclass
class AnnotationVersion:
    version_id: str
    batch_id: str
    annotation_id: str
    version_number: int
    annotation: TideStationAnnotation
    applied_remark: Optional[str] = None
    deltas: List[RemarkDelta] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class ExportRecord:
    export_id: str
    batch_id: str
    version_id: str
    export_type: str
    export_path: str
    content_hash: str
    exported_at: datetime = field(default_factory=datetime.now)
    annotation_count: int = 0


@dataclass
class BatchProcessResult:
    batch_id: str
    source_files: List[str]
    annotations: List[TideStationAnnotation]
    versions: List[AnnotationVersion]
    exports: List[ExportRecord]
    processed_at: datetime = field(default_factory=datetime.now)
    has_exceptions: bool = False


def generate_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def dataclass_to_json(obj: Any) -> str:
    def default(o):
        if isinstance(o, datetime):
            return o.isoformat()
        if isinstance(o, Enum):
            return o.value
        if hasattr(o, "__dataclass_fields__"):
            return asdict(o)
        return str(o)
    return json.dumps(obj, default=default, ensure_ascii=False, indent=2)
