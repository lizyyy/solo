from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
import uuid


class ProcessingStatus(str, Enum):
    IMPORTED = "imported"
    PHOTO_REVIEWED = "photo_reviewed"
    PENDING_REVIEW = "pending_review"
    CONFIRMED_NORMAL = "confirmed_normal"
    CONFIRMED_ABNORMAL = "confirmed_abnormal"
    UPDATED = "updated"
    ROLLED_BACK = "rolled_back"


class EvidenceSource(str, Enum):
    RESIDENT_COMPLAINT = "resident_complaint"
    INTERSECTION_PHOTO = "intersection_photo"
    MANUAL_CONFIRMATION = "manual_confirmation"


class AbnormalType(str, Enum):
    TEMPORARY_DETOUR_NOT_SYNCED = "temporary_detour_not_synced"
    OBSTRUCTION_FOUND = "obstruction_found"
    OTHER = "other"


@dataclass
class ResidentComplaint:
    complaint_id: str
    original_row_number: int
    raw_data: Dict[str, Any]
    location: str
    complaint_content: str
    imported_at: datetime
    imported_by: str
    manual_changes: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["imported_at"] = self.imported_at.isoformat()
        return data


@dataclass
class IntersectionPhoto:
    photo_id: str
    complaint_id: str
    photo_url: str
    location: str
    scene_description: str
    reviewed_by: str
    reviewed_at: datetime
    raw_data: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["reviewed_at"] = self.reviewed_at.isoformat()
        return data


@dataclass
class AuditLog:
    log_id: str
    complaint_id: str
    source: EvidenceSource
    action: str
    previous_status: Optional[ProcessingStatus]
    new_status: ProcessingStatus
    operator: str
    timestamp: datetime
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["timestamp"] = self.timestamp.isoformat()
        data["source"] = self.source.value
        data["previous_status"] = self.previous_status.value if self.previous_status else None
        data["new_status"] = self.new_status.value
        return data


@dataclass
class ClearanceRecord:
    record_id: str
    complaint_id: str
    complaint: ResidentComplaint
    photos: List[IntersectionPhoto] = field(default_factory=list)
    current_status: ProcessingStatus = ProcessingStatus.IMPORTED
    abnormal_type: Optional[AbnormalType] = None
    abnormal_note: Optional[str] = None
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    audit_logs: List[AuditLog] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def add_photo(self, photo: IntersectionPhoto) -> None:
        self.photos.append(photo)
        self.updated_at = datetime.now()

    def add_audit_log(self, log: AuditLog) -> None:
        self.audit_logs.append(log)
        self.updated_at = datetime.now()

    def update_status(
        self,
        new_status: ProcessingStatus,
        operator: str,
        source: EvidenceSource,
        details: Optional[Dict[str, Any]] = None,
        abnormal_type: Optional[AbnormalType] = None,
        abnormal_note: Optional[str] = None,
    ) -> None:
        log = AuditLog(
            log_id=str(uuid.uuid4()),
            complaint_id=self.complaint_id,
            source=source,
            action=f"status_change:{self.current_status.value}->{new_status.value}",
            previous_status=self.current_status,
            new_status=new_status,
            operator=operator,
            timestamp=datetime.now(),
            details=details or {},
        )
        self.add_audit_log(log)
        self.current_status = new_status
        if abnormal_type:
            self.abnormal_type = abnormal_type
        if abnormal_note:
            self.abnormal_note = abnormal_note
        if new_status in [ProcessingStatus.CONFIRMED_NORMAL, ProcessingStatus.CONFIRMED_ABNORMAL]:
            self.confirmed_by = operator
            self.confirmed_at = datetime.now()
        self.updated_at = datetime.now()

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["current_status"] = self.current_status.value
        data["abnormal_type"] = self.abnormal_type.value if self.abnormal_type else None
        data["complaint"] = self.complaint.to_dict()
        data["photos"] = [p.to_dict() for p in self.photos]
        data["audit_logs"] = [l.to_dict() for l in self.audit_logs]
        data["created_at"] = self.created_at.isoformat()
        data["updated_at"] = self.updated_at.isoformat()
        data["confirmed_at"] = self.confirmed_at.isoformat() if self.confirmed_at else None
        return data
