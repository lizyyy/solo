from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional


class TempUnit(str, Enum):
    CELSIUS = "celsius"
    KELVIN = "kelvin"


class RecordSource(str, Enum):
    CHAT_SCREENSHOT = "chat_screenshot"
    SAMPLING_INTERVAL_NOTE = "sampling_interval_note"


class ReviewStatus(str, Enum):
    NORMAL = "normal"
    PENDING_REVIEW = "pending_review"
    SUPPLEMENTED = "supplemented"


class ConflictResolution(str, Enum):
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    PENDING = "pending"


@dataclass
class PendingReviewInfo:
    original_statement: str = ""
    suggested_value: str = ""
    reason: str = ""
    next_handler: str = ""
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class ReviewRecord:
    id: str
    equipment_id: str
    temperature_value: float
    temperature_unit: TempUnit
    efficiency: float
    source: RecordSource
    status: ReviewStatus = ReviewStatus.NORMAL
    recorded_at: datetime = field(default_factory=datetime.now)
    reviewed_by: Optional[str] = None
    original_unit: Optional[TempUnit] = None
    supplemental_source: Optional[RecordSource] = None
    note: str = ""
    pending_review: Optional[PendingReviewInfo] = None
    original_value_before_supplement: Optional[float] = None
    original_efficiency_before_supplement: Optional[float] = None
    related_screenshot_id: Optional[str] = None


@dataclass
class ChatScreenshot:
    id: str
    equipment_id: str
    temperature_value: float
    temperature_unit: TempUnit
    efficiency: float
    captured_at: datetime = field(default_factory=datetime.now)
    imported: bool = False


@dataclass
class SamplingIntervalNote:
    id: str
    equipment_id: str
    temperature_value: float
    temperature_unit: TempUnit
    efficiency: float
    interval_seconds: int
    documented_at: datetime = field(default_factory=datetime.now)
    is_old_caliber: bool = False


@dataclass
class ConflictEvidence:
    screenshot_id: str
    note_id: str
    equipment_id: str
    screenshot_temp: tuple[float, TempUnit]
    note_temp: tuple[float, TempUnit]
    screenshot_efficiency: float
    note_efficiency: float
    resolution: ConflictResolution = ConflictResolution.PENDING
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution_note: str = ""


@dataclass
class AuditEntry:
    id: str
    record_id: str
    changed_by: str
    change_type: str
    old_value: str
    new_value: str
    reason: str
    affected_results: list[str] = field(default_factory=list)
    changed_at: datetime = field(default_factory=datetime.now)


@dataclass
class HandoverReport:
    id: str
    equipment_id: str
    records: list[ReviewRecord] = field(default_factory=list)
    conflicts: list[ConflictEvidence] = field(default_factory=list)
    audit_entries: list[AuditEntry] = field(default_factory=list)
    generated_at: datetime = field(default_factory=datetime.now)
    summary: str = ""
