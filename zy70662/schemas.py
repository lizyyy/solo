from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class AgeGroupBase(BaseModel):
    name: str
    description: Optional[str] = None
    min_age: Optional[int] = None
    max_age: Optional[int] = None


class AgeGroupCreate(AgeGroupBase):
    pass


class AgeGroup(AgeGroupBase):
    id: int

    class Config:
        from_attributes = True


class ParticipantBase(BaseModel):
    bib_number: str
    name: str
    age: Optional[int] = None
    age_group_id: Optional[int] = None


class ParticipantCreate(ParticipantBase):
    pass


class Participant(ParticipantBase):
    id: int

    class Config:
        from_attributes = True


class TimeRecordBase(BaseModel):
    participant_id: int
    checkpoint: str
    time_seconds: float
    is_valid: bool = True
    notes: Optional[str] = None


class TimeRecordCreate(TimeRecordBase):
    pass


class TimeRecord(TimeRecordBase):
    id: int
    recorded_at: datetime

    class Config:
        from_attributes = True


class PenaltyBase(BaseModel):
    participant_id: int
    penalty_type: str
    time_penalty_seconds: float = 0.0
    rank_penalty: int = 0
    description: Optional[str] = None


class PenaltyCreate(PenaltyBase):
    pass


class Penalty(PenaltyBase):
    id: int
    applied: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AppealBase(BaseModel):
    appeal_number: str
    participant_id: int
    reason: str


class AppealCreate(AppealBase):
    pass


class AppealReview(BaseModel):
    status: str
    decision: str
    decision_notes: Optional[str] = None
    reviewer: Optional[str] = None


class Appeal(AppealBase):
    id: int
    status: str
    submitted_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewer: Optional[str] = None
    decision: Optional[str] = None
    decision_notes: Optional[str] = None

    class Config:
        from_attributes = True


class ScoreBase(BaseModel):
    participant_id: int
    raw_time_seconds: float
    penalty_time_seconds: float = 0.0
    final_time_seconds: float
    age_group_id: Optional[int] = None


class ScoreCreate(ScoreBase):
    pass


class Score(ScoreBase):
    id: int
    overall_rank: Optional[int] = None
    group_rank: Optional[int] = None
    is_verified: bool
    has_appeal: bool
    last_updated: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReviewReportBase(BaseModel):
    appeal_id: int
    report_content: str
    generated_by: Optional[str] = None
    export_format: str = "json"


class ReviewReportCreate(ReviewReportBase):
    pass


class ReviewReport(ReviewReportBase):
    id: int
    generated_at: datetime

    class Config:
        from_attributes = True


class RecalculateRequest(BaseModel):
    participant_ids: Optional[List[int]] = None
    age_group_ids: Optional[List[int]] = None
    apply_penalties: bool = True
    update_ranks: bool = True


class ExportRequest(BaseModel):
    appeal_id: int
    format: str = "json"
    include_raw_data: bool = True


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[dict] = None


class ScoreWithDetails(Score):
    participant: Participant
    age_group: Optional[AgeGroup] = None
