from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
import json
from uuid import uuid4


class ImportStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"


class SliceStatus(Enum):
    PENDING = "pending"
    CHECKING = "checking"
    READY = "ready"
    EXPORTED = "exported"
    FAILED = "failed"
    REVIEW_NEEDED = "review_needed"


class SliceType(Enum):
    TOPIC = "topic"
    VIOLATION = "violation"
    PRODUCT = "product"
    SUBTITLE = "subtitle"


class AuditAction(Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    CORRECT = "correct"
    IMPORT = "import"


@dataclass
class TimelineSegment:
    start_time: float
    end_time: float
    title: str
    description: Optional[str] = None


@dataclass
class Subtitle:
    id: str
    start_time: float
    end_time: float
    text: str


@dataclass
class Product:
    product_id: str
    name: str
    link_time: float
    unlink_time: Optional[float] = None
    category: Optional[str] = None


@dataclass
class Violation:
    id: str
    start_time: float
    end_time: float
    level: str
    reason: str


@dataclass
class Slice:
    slice_id: str
    slice_type: SliceType
    start_time: float
    end_time: float
    duration: float
    status: SliceStatus
    title: str
    description: Optional[str] = None
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    violation_id: Optional[str] = None
    violation_reason: Optional[str] = None
    subtitle_ids: List[str] = field(default_factory=list)
    overlapping_slices: List[str] = field(default_factory=list)
    export_path: Optional[str] = None
    export_time: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class AuditLog:
    id: str
    action: AuditAction
    entity_type: str
    entity_id: str
    before: Optional[Dict[str, Any]]
    after: Optional[Dict[str, Any]]
    operator: str
    reason: Optional[str]
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class ImportRecord:
    id: str
    data_type: str
    file_path: str
    status: ImportStatus
    record_count: int = 0
    error_message: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None


@dataclass
class ProjectState:
    project_name: str
    created_at: datetime
    updated_at: datetime
    subtitle_offset: float = 0.0
    timeline_segments: List[TimelineSegment] = field(default_factory=list)
    subtitles: List[Subtitle] = field(default_factory=list)
    products: List[Product] = field(default_factory=list)
    violations: List[Violation] = field(default_factory=list)
    slices: List[Slice] = field(default_factory=list)
    import_records: List[ImportRecord] = field(default_factory=list)
    audit_logs: List[AuditLog] = field(default_factory=list)
    processed_products: set = field(default_factory=set)
    exported_slices: set = field(default_factory=set)

    def to_dict(self) -> Dict[str, Any]:
        def serialize_value(v):
            if isinstance(v, datetime):
                return v.isoformat()
            if isinstance(v, Enum):
                return v.value
            if isinstance(v, set):
                return list(v)
            if hasattr(v, 'to_dict'):
                return v.to_dict()
            return v

        def serialize_obj(obj):
            if isinstance(obj, dict):
                return {k: serialize_obj(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [serialize_obj(i) for i in obj]
            return serialize_value(obj)

        return serialize_obj(asdict(self))

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ProjectState':
        def parse_datetime(v):
            if isinstance(v, str):
                return datetime.fromisoformat(v)
            return v

        state = cls(
            project_name=data["project_name"],
            created_at=parse_datetime(data["created_at"]),
            updated_at=parse_datetime(data["updated_at"]),
            subtitle_offset=data.get("subtitle_offset", 0.0),
        )

        for ts in data.get("timeline_segments", []):
            state.timeline_segments.append(TimelineSegment(**ts))

        for sub in data.get("subtitles", []):
            state.subtitles.append(Subtitle(**sub))

        for p in data.get("products", []):
            state.products.append(Product(**p))

        for v in data.get("violations", []):
            state.violations.append(Violation(**v))

        for s in data.get("slices", []):
            s["slice_type"] = SliceType(s["slice_type"])
            s["status"] = SliceStatus(s["status"])
            if "export_time" in s and s["export_time"]:
                s["export_time"] = parse_datetime(s["export_time"])
            s["created_at"] = parse_datetime(s["created_at"])
            s["updated_at"] = parse_datetime(s["updated_at"])
            state.slices.append(Slice(**s))

        for ir in data.get("import_records", []):
            ir["status"] = ImportStatus(ir["status"])
            if "completed_at" in ir and ir["completed_at"]:
                ir["completed_at"] = parse_datetime(ir["completed_at"])
            ir["created_at"] = parse_datetime(ir["created_at"])
            state.import_records.append(ImportRecord(**ir))

        for al in data.get("audit_logs", []):
            al["action"] = AuditAction(al["action"])
            al["timestamp"] = parse_datetime(al["timestamp"])
            state.audit_logs.append(AuditLog(**al))

        state.processed_products = set(data.get("processed_products", []))
        state.exported_slices = set(data.get("exported_slices", []))

        return state
