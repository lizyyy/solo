from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
from enum import Enum
import uuid


class RecordStatus(str, Enum):
    SUCCESS = "success"
    PENDING_REVIEW = "pending_review"
    LEGACY_CALIBRATION = "legacy_calibration"
    CONFLICT = "conflict"
    PROCESSED = "processed"


class DataSourceType(str, Enum):
    LECTURE_NOTE = "lecture_note"
    BUSINESS_TABLE = "business_table"
    SCREENSHOT = "screenshot"
    SUMMARY_PAGE = "summary_page"


@dataclass
class DataSource:
    source_type: DataSourceType
    source_name: str
    source_path: Optional[str] = None
    import_time: datetime = field(default_factory=datetime.now)
    field_mapping: Dict[str, str] = field(default_factory=dict)
    raw_data_hash: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source_type": self.source_type.value,
            "source_name": self.source_name,
            "source_path": self.source_path,
            "import_time": self.import_time.isoformat(),
            "field_mapping": self.field_mapping,
            "raw_data_hash": self.raw_data_hash
        }


@dataclass
class VolatilityPoint:
    strike: float
    maturity: float
    implied_vol: float
    tenor: str = ""
    option_type: str = "call"
    raw_value: Optional[float] = None
    data_source_id: str = ""
    point_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    is_outlier: bool = False
    outlier_reason: str = ""
    is_interpolated: bool = False
    interpolated_from: List[str] = field(default_factory=list)
    confidence: float = 1.0
    tags: List[str] = field(default_factory=list)
    review_comment: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "point_id": self.point_id,
            "strike": self.strike,
            "maturity": self.maturity,
            "implied_vol": self.implied_vol,
            "tenor": self.tenor,
            "option_type": self.option_type,
            "raw_value": self.raw_value,
            "data_source_id": self.data_source_id,
            "is_outlier": self.is_outlier,
            "outlier_reason": self.outlier_reason,
            "is_interpolated": self.is_interpolated,
            "interpolated_from": self.interpolated_from,
            "confidence": self.confidence,
            "tags": self.tags,
            "review_comment": self.review_comment
        }


@dataclass
class VolatilitySurface:
    surface_id: str
    underlying: str
    trade_date: datetime
    points: List[VolatilityPoint]
    data_sources: List[DataSource]
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    status: RecordStatus = RecordStatus.PENDING_REVIEW
    comments: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    def get_tenors(self) -> List[str]:
        return sorted(list(set(p.tenor for p in self.points)))

    def get_maturities(self) -> List[float]:
        return sorted(list(set(p.maturity for p in self.points)))

    def get_strikes(self) -> List[float]:
        return sorted(list(set(p.strike for p in self.points)))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "surface_id": self.surface_id,
            "underlying": self.underlying,
            "trade_date": self.trade_date.isoformat(),
            "points": [p.to_dict() for p in self.points],
            "data_sources": [ds.to_dict() for ds in self.data_sources],
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "status": self.status.value,
            "comments": self.comments,
            "metadata": self.metadata
        }


@dataclass
class ParameterVersion:
    version_id: str
    parameter_name: str
    value: Any
    default_value: Any
    is_user_modified: bool = False
    modified_at: Optional[datetime] = None
    modified_by: str = "system"
    valid_from: datetime = field(default_factory=datetime.now)
    valid_to: Optional[datetime] = None
    comment: str = ""
    surface_ids_used: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "version_id": self.version_id,
            "parameter_name": self.parameter_name,
            "value": self.value,
            "default_value": self.default_value,
            "is_user_modified": self.is_user_modified,
            "modified_at": self.modified_at.isoformat() if self.modified_at else None,
            "modified_by": self.modified_by,
            "valid_from": self.valid_from.isoformat(),
            "valid_to": self.valid_to.isoformat() if self.valid_to else None,
            "comment": self.comment,
            "surface_ids_used": self.surface_ids_used
        }


@dataclass
class AuditLog:
    log_id: str
    timestamp: datetime
    action: str
    surface_id: str = ""
    point_id: str = ""
    old_value: Any = None
    new_value: Any = None
    operator: str = "system"
    reason: str = ""
    parameters_used: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "log_id": self.log_id,
            "timestamp": self.timestamp.isoformat(),
            "action": self.action,
            "surface_id": self.surface_id,
            "point_id": self.point_id,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "operator": self.operator,
            "reason": self.reason,
            "parameters_used": self.parameters_used
        }


@dataclass
class ConflictRecord:
    conflict_id: str
    surface_id: str
    point_id: str
    summary_page_value: float
    imported_value: float
    summary_page_source: str
    imported_source: str
    difference: float
    suggested_action: str
    timestamp: datetime = field(default_factory=datetime.now)
    resolved: bool = False
    resolution: str = ""
    resolved_by: str = ""
    resolved_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "conflict_id": self.conflict_id,
            "surface_id": self.surface_id,
            "point_id": self.point_id,
            "summary_page_value": self.summary_page_value,
            "imported_value": self.imported_value,
            "summary_page_source": self.summary_page_source,
            "imported_source": self.imported_source,
            "difference": self.difference,
            "suggested_action": self.suggested_action,
            "timestamp": self.timestamp.isoformat(),
            "resolved": self.resolved,
            "resolution": self.resolution,
            "resolved_by": self.resolved_by,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None
        }


@dataclass
class CleanResult:
    surface: VolatilitySurface
    original_points: int
    cleaned_points: int
    outliers_removed: int
    interpolated_points: int
    conflicts_found: List[ConflictRecord]
    parameter_versions_used: List[ParameterVersion]
    audit_trail: List[AuditLog]
    processing_time: float = 0.0
    status_summary: Dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "surface": self.surface.to_dict(),
            "original_points": self.original_points,
            "cleaned_points": self.cleaned_points,
            "outliers_removed": self.outliers_removed,
            "interpolated_points": self.interpolated_points,
            "conflicts_found": [c.to_dict() for c in self.conflicts_found],
            "parameter_versions_used": [p.to_dict() for p in self.parameter_versions_used],
            "audit_trail": [a.to_dict() for a in self.audit_trail],
            "processing_time": self.processing_time,
            "status_summary": self.status_summary
        }
