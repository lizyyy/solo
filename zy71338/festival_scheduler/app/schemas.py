from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.models import (
    ConflictType, ConflictSeverity, ConflictStatus,
    ScheduleStatus, NotificationStatus,
)


class ErrorResponse(BaseModel):
    code: int
    message: str
    detail: Optional[str] = None


class StageCreate(BaseModel):
    name: str = Field(..., max_length=100)
    location: Optional[str] = None
    capacity: Optional[int] = None
    noise_limit_db: float = 95.0
    has_noise_monitor: bool = False
    equipment_tags: Optional[str] = None
    available_from: Optional[datetime] = None
    available_to: Optional[datetime] = None


class StageRead(StageCreate):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ArtistAvailabilityCreate(BaseModel):
    window_start: datetime
    window_end: datetime
    is_hard_constraint: bool = True
    note: Optional[str] = None


class ArtistAvailabilityRead(ArtistAvailabilityCreate):
    id: int
    artist_id: int

    model_config = {"from_attributes": True}


class ArtistCreate(BaseModel):
    name: str = Field(..., max_length=100)
    genre: Optional[str] = None
    avg_volume_db: Optional[float] = None
    rider_equipment: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    notes: Optional[str] = None


class ArtistRead(ArtistCreate):
    id: int
    created_at: datetime
    updated_at: datetime
    availability_windows: List[ArtistAvailabilityRead] = []

    model_config = {"from_attributes": True}


class ChangeoverRuleCreate(BaseModel):
    from_artist_id: Optional[int] = None
    to_artist_id: Optional[int] = None
    from_genre: Optional[str] = None
    to_genre: Optional[str] = None
    stage_id: Optional[int] = None
    duration_minutes: int = 30
    equipment_swap: Optional[str] = None
    note: Optional[str] = None


class ChangeoverRuleRead(ChangeoverRuleCreate):
    id: int

    model_config = {"from_attributes": True}


class NoiseRestrictionCreate(BaseModel):
    stage_id: Optional[int] = None
    area_name: Optional[str] = None
    max_db: float
    restricted_from: datetime
    restricted_to: datetime
    reason: Optional[str] = None
    authority: Optional[str] = None
    is_recurring_daily: bool = False


class NoiseRestrictionRead(NoiseRestrictionCreate):
    id: int

    model_config = {"from_attributes": True}


class ScheduleCreate(BaseModel):
    artist_id: int
    stage_id: int
    start_time: datetime
    end_time: datetime
    status: ScheduleStatus = ScheduleStatus.DRAFT
    changeover_before_minutes: int = 0
    changeover_after_minutes: int = 0
    estimated_volume_db: Optional[float] = None
    assigned_by: Optional[str] = None
    note: Optional[str] = None


class ScheduleUpdate(BaseModel):
    artist_id: Optional[int] = None
    stage_id: Optional[int] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[ScheduleStatus] = None
    changeover_before_minutes: Optional[int] = None
    changeover_after_minutes: Optional[int] = None
    estimated_volume_db: Optional[float] = None
    assigned_by: Optional[str] = None
    note: Optional[str] = None
    change_reason: Optional[str] = None


class ScheduleRead(BaseModel):
    id: int
    artist_id: int
    stage_id: int
    start_time: datetime
    end_time: datetime
    status: ScheduleStatus
    changeover_before_minutes: int
    changeover_after_minutes: int
    estimated_volume_db: Optional[float]
    assigned_by: Optional[str]
    note: Optional[str]
    created_at: datetime
    updated_at: datetime
    artist_name: Optional[str] = None
    stage_name: Optional[str] = None

    model_config = {"from_attributes": True}


class ScheduleHistoryRead(BaseModel):
    id: int
    schedule_id: int
    change_type: str
    field_name: Optional[str]
    old_value: Optional[str]
    new_value: Optional[str]
    changed_by: Optional[str]
    change_reason: Optional[str]
    changed_at: datetime

    model_config = {"from_attributes": True}


class ConflictRead(BaseModel):
    id: int
    schedule_id: int
    conflict_type: ConflictType
    severity: ConflictSeverity
    status: ConflictStatus
    message: str
    detail: Optional[str]
    related_schedule_id: Optional[int]
    detected_at: datetime
    resolved_at: Optional[datetime]
    resolved_by: Optional[str]
    resolution_note: Optional[str]

    model_config = {"from_attributes": True}


class ConflictResolve(BaseModel):
    status: ConflictStatus
    resolved_by: str
    resolution_note: Optional[str] = None


class NotificationRead(BaseModel):
    id: int
    recipient: str
    recipient_role: Optional[str]
    subject: str
    body: str
    notification_type: str
    status: NotificationStatus
    related_schedule_id: Optional[int]
    related_conflict_id: Optional[int]
    created_at: datetime
    sent_at: Optional[datetime]
    read_at: Optional[datetime]

    model_config = {"from_attributes": True}


class NotificationCreate(BaseModel):
    recipient: str
    recipient_role: Optional[str] = None
    subject: str
    body: str
    notification_type: str
    related_schedule_id: Optional[int] = None
    related_conflict_id: Optional[int] = None


class ConflictCheckResult(BaseModel):
    schedule_id: int
    has_conflicts: bool
    conflicts: List[ConflictRead]


class ScheduleReportItem(BaseModel):
    schedule: ScheduleRead
    conflicts: List[ConflictRead]
    artist_availability_ok: bool
    noise_ok: bool
    changeover_ok: bool


class ScheduleReport(BaseModel):
    generated_at: datetime
    total_schedules: int
    total_conflicts: int
    critical_conflicts: int
    items: List[ScheduleReportItem]
