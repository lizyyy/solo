from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class StudentCreate(BaseModel):
    name: str
    instrument: str = "drums"


class StudentOut(BaseModel):
    id: int
    name: str
    instrument: str
    enrolled_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class DeviationPoint(BaseModel):
    beat_index: int
    is_weak_beat: bool
    deviation_ms: float


class BPMSegment(BaseModel):
    start_beat: int
    end_beat: int
    bpm: int
    is_inferred: bool = False


class PracticeRecordCreate(BaseModel):
    student_id: int
    practiced_at: datetime
    bpm: int
    duration_seconds: int
    time_signature: str = "4/4"
    raw_deviations: list[DeviationPoint] = []
    bpm_change_segments: list[BPMSegment] = []


class PracticeRecordOut(BaseModel):
    id: int
    student_id: int
    practiced_at: datetime
    bpm: int
    duration_seconds: int
    time_signature: str
    mean_deviation_ms: float
    max_deviation_ms: float
    weak_beat_deviations: list
    strong_beat_deviations: list
    is_backdated: bool
    is_duplicate_flagged: bool
    confirmation_status: str
    bpm_change_segments: list
    missing_segment_flagged: bool
    weak_beat_misjudgment_flagged: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CommentCreate(BaseModel):
    student_id: int
    week_start: datetime
    week_end: datetime
    content: str


class CommentOut(BaseModel):
    id: int
    student_id: int
    week_start: datetime
    week_end: datetime
    content: str
    version: int
    supersedes_id: Optional[int] = None
    is_current: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ConfirmationCreate(BaseModel):
    practice_record_id: int
    action: str = Field(..., pattern="^(confirm|reject)$")
    operator: str
    note: Optional[str] = None


class ConfirmationOut(BaseModel):
    id: int
    practice_record_id: int
    action: str
    previous_status: str
    new_status: str
    operator: str
    note: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogOut(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    action: str
    before_state: Optional[dict]
    after_state: Optional[dict]
    operator: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class WeeklyReportOut(BaseModel):
    id: int
    student_id: int
    week_start: datetime
    week_end: datetime
    total_practice_sessions: int
    total_duration_seconds: int
    avg_deviation_ms: float
    best_deviation_ms: float
    bpm_range: dict
    segment_summary: list
    progress_interpretation: dict
    comment_id: Optional[int]
    generated_at: datetime

    class Config:
        from_attributes = True


class DeviationStatsOut(BaseModel):
    student_id: int
    week_start: Optional[datetime] = None
    week_end: Optional[datetime] = None
    session_count: int
    total_duration_seconds: int
    avg_deviation_ms: float
    best_deviation_ms: float
    worst_deviation_ms: float
    weak_beat_avg_deviation_ms: float
    strong_beat_avg_deviation_ms: float
    weak_beat_misjudgment_count: int
    missing_segment_count: int
