from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, List
from datetime import datetime


class TrackStatus(str, Enum):
    NORMAL = "normal"
    NEEDS_REWORK = "needs_rework"
    PENDING_COPYRIGHT_REVIEW = "pending_copyright_review"
    APPROVED = "approved"


class NextContact(str, Enum):
    COPYRIGHT_OPERATIONS = "版权运营"
    TOUR_COORDINATOR_AMEI = "巡演统筹阿梅"
    RECORDING_STUDIO = "录音棚"


@dataclass
class TicketExport:
    track_id: str
    track_name: str
    planned_hours: float
    actual_hours: float
    track_remark: str
    import_time: datetime = field(default_factory=datetime.now)
    has_rework_reason: bool = False
    rework_keywords: List[str] = field(default_factory=list)

    @property
    def hour_diff(self) -> float:
        return self.actual_hours - self.planned_hours


@dataclass
class AudioFile:
    track_id: str
    file_name: str
    audio_remark: str = ""
    reviewed_by_amei: bool = False
    review_time: Optional[datetime] = None


@dataclass
class RehearsalChange:
    track_id: str
    track_name: str
    change_reason: str
    kept_why: str
    missing_materials: List[str] = field(default_factory=list)
    next_contact: NextContact = NextContact.COPYRIGHT_OPERATIONS
    status: TrackStatus = TrackStatus.PENDING_COPYRIGHT_REVIEW
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    notes: str = ""


@dataclass
class WorkflowState:
    step: int = 1
    ticket_imported: bool = False
    amei_review_done: bool = False
    rehearsal_updated: bool = False
    copyright_review_done: bool = False
