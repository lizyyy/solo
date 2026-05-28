from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, List, Dict, Any
from uuid import uuid4


class IssueType(Enum):
    MISSING_FIELD = "missing_field"
    INVALID_DATE = "invalid_date"
    INVALID_PRICE = "invalid_price"
    UNKNOWN_CURRENCY = "unknown_currency"
    CURRENCY_NOT_NORMALIZED = "currency_not_normalized"
    DUPLICATE_RECORD = "duplicate_record"
    EXTREME_VALUE = "extreme_value"
    OUTLIER = "outlier"
    CORRUPT_FILE = "corrupt_file"
    PARSE_ERROR = "parse_error"


class IssueSeverity(Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class RecordState(Enum):
    RAW = "raw"
    IMPORTED = "imported"
    CURRENCY_NORMALIZED = "currency_normalized"
    DEDUPLICATED = "deduplicated"
    OUTLIER_CHECKED = "outlier_checked"
    INDEX_CALCULATED = "index_calculated"
    EXCLUDED = "excluded"


class ProcessingStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"


def _make_datetime():
    return datetime.now()


@dataclass
class Issue:
    issue_type: IssueType
    severity: IssueSeverity
    message: str
    field: Optional[str] = None
    impact: Optional[str] = None
    suggestion: Optional[str] = None
    affected_records: int = 1
    timestamp: datetime = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.issue_type.value,
            "severity": self.severity.value,
            "message": self.message,
            "field": self.field,
            "impact": self.impact,
            "suggestion": self.suggestion,
            "affected_records": self.affected_records,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class Artist:
    artist_id: str
    name: str
    birth_year: Optional[int] = None
    death_year: Optional[int] = None
    nationality: Optional[str] = None
    total_auctions: int = 0
    issues: List[Issue] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "artist_id": self.artist_id,
            "name": self.name,
            "birth_year": self.birth_year,
            "death_year": self.death_year,
            "nationality": self.nationality,
            "total_auctions": self.total_auctions,
            "issues_count": len(self.issues),
        }


@dataclass
class Medium:
    medium_id: str
    name: str
    category: Optional[str] = None
    total_records: int = 0
    issues: List[Issue] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "medium_id": self.medium_id,
            "name": self.name,
            "category": self.category,
            "total_records": self.total_records,
            "issues_count": len(self.issues),
        }


@dataclass
class AuctionRecord:
    record_id: str = field(default_factory=lambda: str(uuid4()))
    source_file: str = ""
    lot_number: Optional[str] = None
    artwork_title: Optional[str] = None
    artist_name: Optional[str] = None
    artist: Optional[Artist] = None
    medium_name: Optional[str] = None
    medium: Optional[Medium] = None
    dimensions: Optional[str] = None
    auction_date: Optional[datetime] = None
    auction_house: Optional[str] = None
    location: Optional[str] = None
    original_currency: Optional[str] = None
    original_price: Optional[float] = None
    usd_price: Optional[float] = None
    estimate_low: Optional[float] = None
    estimate_high: Optional[float] = None
    state: RecordState = RecordState.RAW
    issues: List[Issue] = field(default_factory=list)
    duplicate_of: Optional[str] = None
    is_outlier: bool = False
    outlier_score: Optional[float] = None
    index_value: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def add_issue(self, issue: Issue) -> None:
        self.issues.append(issue)

    def has_errors(self) -> bool:
        return any(
            i.severity in (IssueSeverity.ERROR, IssueSeverity.CRITICAL)
            for i in self.issues
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "source_file": self.source_file,
            "lot_number": self.lot_number,
            "artwork_title": self.artwork_title,
            "artist_name": self.artist_name,
            "artist_id": self.artist.artist_id if self.artist else None,
            "medium_name": self.medium_name,
            "medium_id": self.medium.medium_id if self.medium else None,
            "auction_date": self.auction_date.isoformat() if self.auction_date else None,
            "auction_house": self.auction_house,
            "original_currency": self.original_currency,
            "original_price": self.original_price,
            "usd_price": self.usd_price,
            "state": self.state.value,
            "issues_count": len(self.issues),
            "has_errors": self.has_errors(),
            "is_duplicate": self.duplicate_of is not None,
            "is_outlier": self.is_outlier,
            "outlier_score": self.outlier_score,
            "index_value": self.index_value,
        }


@dataclass
class IndexPoint:
    period: str
    period_start: datetime
    period_end: datetime
    index_value: float
    record_count: int
    median_price: float
    mean_price: float
    std_price: float
    artist_count: int
    medium_count: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "period": self.period,
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "index_value": self.index_value,
            "record_count": self.record_count,
            "median_price": self.median_price,
            "mean_price": self.mean_price,
            "std_price": self.std_price,
            "artist_count": self.artist_count,
            "medium_count": self.medium_count,
        }


@dataclass
class ProcessingResult:
    status: ProcessingStatus
    total_files: int = 0
    successful_files: int = 0
    failed_files: int = 0
    total_records: int = 0
    valid_records: int = 0
    excluded_records: int = 0
    records_by_state: Dict[str, int] = field(default_factory=dict)
    issues: List[Issue] = field(default_factory=list)
    file_results: List[Dict[str, Any]] = field(default_factory=list)
    artists: Dict[str, Artist] = field(default_factory=dict)
    media: Dict[str, Medium] = field(default_factory=dict)
    records: List[AuctionRecord] = field(default_factory=list)
    index_series: List[IndexPoint] = field(default_factory=list)
    started_at: datetime = None
    completed_at: Optional[datetime] = None

    def __post_init__(self):
        if self.started_at is None:
            self.started_at = datetime.now()

    def to_summary_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status.value,
            "total_files": self.total_files,
            "successful_files": self.successful_files,
            "failed_files": self.failed_files,
            "total_records": self.total_records,
            "valid_records": self.valid_records,
            "excluded_records": self.excluded_records,
            "records_by_state": self.records_by_state,
            "total_issues": len(self.issues),
            "issues_by_type": self._get_issues_by_type(),
            "issues_by_severity": self._get_issues_by_severity(),
            "artist_count": len(self.artists),
            "medium_count": len(self.media),
            "index_points_count": len(self.index_series),
            "processing_time_seconds": (
                (self.completed_at - self.started_at).total_seconds()
                if self.completed_at
                else None
            ),
        }

    def _get_issues_by_type(self) -> Dict[str, int]:
        result: Dict[str, int] = {}
        for issue in self.issues:
            t = issue.issue_type.value
            result[t] = result.get(t, 0) + 1
        return result

    def _get_issues_by_severity(self) -> Dict[str, int]:
        result: Dict[str, int] = {}
        for issue in self.issues:
            s = issue.severity.value
            result[s] = result.get(s, 0) + 1
        return result
