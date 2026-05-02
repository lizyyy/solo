from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from decimal import Decimal


class IssueSeverity(Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class IssueType(Enum):
    DUPLICATE_WAYBILL = "duplicate_waybill"
    PHOTO_MISSING = "photo_missing"
    TIMESTAMP_MISSING = "timestamp_missing"
    TIME_OUT_OF_ORDER = "time_out_of_order"
    NOTE_CONFLICT = "note_conflict"
    CLAIM_AMOUNT_ABNORMAL = "claim_amount_abnormal"
    CLAIM_DOCUMENT_MISSING = "claim_document_missing"


class ReviewStatus(Enum):
    PENDING = "pending"
    REVIEWED = "reviewed"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class FileCategory(Enum):
    UNKNOWN = "unknown"
    WAYBILL_PHOTO = "waybill_photo"
    PACKAGE_PHOTO = "package_photo"
    DAMAGE_PHOTO = "damage_photo"
    NOTE_CSV = "note_csv"
    CLAIM_FORM = "claim_form"
    OTHER = "other"


@dataclass
class FileEntry:
    file_id: str
    file_path: str
    filename: str
    file_size: int
    extension: str
    category: FileCategory = FileCategory.UNKNOWN
    waybill_number: Optional[str] = None
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None
    exif_timestamp: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def best_timestamp(self) -> Optional[datetime]:
        return self.exif_timestamp or self.created_at or self.modified_at


@dataclass
class ServiceNote:
    note_id: str
    waybill_number: str
    content: str
    operator: str = ""
    timestamp: Optional[datetime] = None
    source_file: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ClaimApplication:
    claim_id: str
    waybill_number: str
    claim_amount: Decimal
    claim_reason: str = ""
    applicant: str = ""
    apply_time: Optional[datetime] = None
    expected_amount: Decimal = Decimal("0")
    approved_amount: Optional[Decimal] = None
    source_file: str = ""
    status: str = "pending"
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PackageEvidence:
    waybill_number: str
    
    photos: List[FileEntry] = field(default_factory=list)
    waybill_photos: List[FileEntry] = field(default_factory=list)
    package_photos: List[FileEntry] = field(default_factory=list)
    damage_photos: List[FileEntry] = field(default_factory=list)
    
    service_notes: List[ServiceNote] = field(default_factory=list)
    claim_applications: List[ClaimApplication] = field(default_factory=list)
    
    issues: List["ValidationIssue"] = field(default_factory=list)
    review_notes: List["ReviewNote"] = field(default_factory=list)
    
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def all_photos(self) -> List[FileEntry]:
        return self.photos + self.waybill_photos + self.package_photos + self.damage_photos
    
    @property
    def earliest_timestamp(self) -> Optional[datetime]:
        timestamps = [p.best_timestamp for p in self.all_photos if p.best_timestamp]
        return min(timestamps) if timestamps else None
    
    @property
    def latest_timestamp(self) -> Optional[datetime]:
        timestamps = [p.best_timestamp for p in self.all_photos if p.best_timestamp]
        return max(timestamps) if timestamps else None


@dataclass
class ValidationIssue:
    issue_id: str
    issue_type: IssueType
    severity: IssueSeverity
    message: str
    waybill_number: str = ""
    affected_files: List[str] = field(default_factory=list)
    affected_notes: List[str] = field(default_factory=list)
    review_status: ReviewStatus = ReviewStatus.PENDING
    review_notes: List["ReviewNote"] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ReviewNote:
    note_id: str
    issue_id: str = ""
    waybill_number: str = ""
    author: str
    content: str
    timestamp: datetime = field(default_factory=datetime.now)
    status_change: Optional[ReviewStatus] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class WorkSession:
    session_id: str
    name: str
    description: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    scanned_directory: str = ""
    
    files: Dict[str, FileEntry] = field(default_factory=dict)
    packages: Dict[str, PackageEvidence] = field(default_factory=dict)
    issues: Dict[str, ValidationIssue] = field(default_factory=dict)
    review_notes: Dict[str, ReviewNote] = field(default_factory=dict)
    
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "name": self.name,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "scanned_directory": self.scanned_directory,
            "metadata": self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "WorkSession":
        session = cls(
            session_id=data["session_id"],
            name=data["name"],
            description=data.get("description", ""),
            scanned_directory=data.get("scanned_directory", ""),
            metadata=data.get("metadata", {})
        )
        if data.get("created_at"):
            session.created_at = datetime.fromisoformat(data["created_at"])
        if data.get("updated_at"):
            session.updated_at = datetime.fromisoformat(data["updated_at"])
        return session
