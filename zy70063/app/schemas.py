from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from .models import DeferralStatus, ExamStatus, ScoreStatus, AuditAction


class StudentBase(BaseModel):
    student_no: str
    name: str
    class_name: Optional[str] = None
    major: Optional[str] = None


class StudentCreate(StudentBase):
    pass


class StudentOut(StudentBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class CourseBase(BaseModel):
    course_code: str
    course_name: str
    credit: Optional[float] = 0


class CourseCreate(CourseBase):
    pass


class CourseOut(CourseBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class ExamBase(BaseModel):
    course_id: int
    exam_type: str = "final"
    exam_date: date
    start_time: str
    end_time: str
    classroom: Optional[str] = None


class ExamCreate(ExamBase):
    is_makeup: Optional[bool] = False
    related_original_exam_id: Optional[int] = None


class ExamOut(ExamBase):
    id: int
    status: ExamStatus
    is_makeup: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class DeferralApplicationBase(BaseModel):
    student_id: int
    exam_id: int
    reason: str
    reason_type: Optional[str] = None
    evidence_url: Optional[str] = None


class DeferralApplicationCreate(DeferralApplicationBase):
    pass


class DeferralApplicationSubmit(BaseModel):
    application_id: int


class DeferralApplicationReview(BaseModel):
    application_id: int
    approved: bool
    review_comment: Optional[str] = None
    reviewer_id: Optional[int] = None


class DeferralApplicationCancel(BaseModel):
    application_id: int
    reason: Optional[str] = None


class DeferralApplicationOut(BaseModel):
    id: int
    student_id: int
    exam_id: int
    reason: str
    reason_type: Optional[str] = None
    status: DeferralStatus
    reviewer_id: Optional[int] = None
    review_comment: Optional[str] = None
    assigned_makeup_exam_id: Optional[int] = None
    batch_key: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class EligibilityCheckRequest(BaseModel):
    student_id: int
    exam_id: int


class EligibilityCheckResult(BaseModel):
    eligible: bool
    reasons: List[str] = []
    warnings: List[str] = []
    student_name: Optional[str] = None
    course_name: Optional[str] = None


class RescheduleRequest(BaseModel):
    application_ids: List[int]
    exam_date: date
    start_time: str
    end_time: str
    classroom: Optional[str] = None
    batch_key: Optional[str] = None


class ScoreBase(BaseModel):
    student_id: int
    exam_id: int
    score_value: Optional[float] = None


class ScoreCreate(ScoreBase):
    pass


class ScoreBatchInput(BaseModel):
    exam_id: int
    scores: List[ScoreBase]
    batch_key: Optional[str] = None


class ScoreUpdate(BaseModel):
    score_value: float
    comment: Optional[str] = None


class ScoreLockRequest(BaseModel):
    exam_id: int
    operator_id: int


class ScoreOut(BaseModel):
    id: int
    student_id: int
    exam_id: int
    score_value: Optional[float]
    score_status: ScoreStatus
    is_rescore: bool
    locked_by: Optional[int] = None
    locked_at: Optional[datetime] = None
    batch_key: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class AuditLogOut(BaseModel):
    id: int
    resource_type: str
    resource_id: int
    action: AuditAction
    operator_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    comment: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class ReportSummary(BaseModel):
    total_applications: int
    pending_review: int
    approved: int
    rejected: int
    cancelled: int
    makeup_exams_created: int
    students_with_makeup: int
    scores_locked: int
    scores_published: int


class DailyReport(BaseModel):
    date: date
    new_applications: int
    reviewed_applications: int
    approved_today: int
    rejected_today: int
    makeup_exams_scheduled: int
