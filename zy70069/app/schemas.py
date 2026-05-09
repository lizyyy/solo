from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from app.models import (
    StudentStatus, PreReviewStatus, TaskStatus, 
    RuleCategory, DisciplineLevel, ThesisStatus
)


class StudentBase(BaseModel):
    student_id: str
    name: str
    department: str
    major: str
    grade: int
    status: StudentStatus = StudentStatus.ACTIVE


class StudentCreate(StudentBase):
    pass


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    major: Optional[str] = None
    grade: Optional[int] = None
    status: Optional[StudentStatus] = None


class StudentResponse(StudentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AcademicRecordBase(BaseModel):
    total_credits: float = 0.0
    required_credits_earned: float = 0.0
    elective_credits_earned: float = 0.0
    gpa: float = 0.0
    failed_courses_count: int = 0
    courses_json: List[Dict[str, Any]] = Field(default_factory=list)


class AcademicRecordCreate(AcademicRecordBase):
    student_id: int


class AcademicRecordResponse(AcademicRecordBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DisciplineBase(BaseModel):
    level: DisciplineLevel
    description: str
    is_cleared: bool = False


class DisciplineCreate(DisciplineBase):
    student_id: int


class DisciplineUpdate(BaseModel):
    is_cleared: Optional[bool] = None


class DisciplineResponse(DisciplineBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ThesisBase(BaseModel):
    title: Optional[str] = None
    status: ThesisStatus = ThesisStatus.NOT_SUBMITTED
    score: Optional[float] = None


class ThesisCreate(ThesisBase):
    student_id: int


class ThesisUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[ThesisStatus] = None
    score: Optional[float] = None


class ThesisResponse(ThesisBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GraduationRuleBase(BaseModel):
    name: str
    category: RuleCategory
    is_active: bool = True
    priority: int = 0
    conditions_json: Dict[str, Any]
    description: str


class GraduationRuleCreate(GraduationRuleBase):
    pass


class GraduationRuleResponse(GraduationRuleBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MissingItemResponse(BaseModel):
    id: int
    rule_category: str
    rule_name: str
    error_code: str
    message: str
    current_value: Optional[Any] = None
    required_value: Optional[Any] = None
    suggestion: Optional[str] = None
    is_resolved: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewActionResponse(BaseModel):
    id: int
    action_type: str
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    reason: str
    operator: str
    created_at: datetime

    class Config:
        from_attributes = True


class PreReviewDetailResponse(BaseModel):
    id: int
    student_id: int
    status: PreReviewStatus
    is_eligible: Optional[bool] = None
    calculated_at: Optional[datetime] = None
    missing_items: List[MissingItemResponse] = []
    review_actions: List[ReviewActionResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PreReviewSummary(BaseModel):
    id: int
    student_id: int
    student_name: str
    student_id_no: str
    department: str
    status: PreReviewStatus
    is_eligible: Optional[bool] = None
    missing_count: int
    calculated_at: Optional[datetime] = None
    last_updated: datetime


class HistoryRecordResponse(BaseModel):
    id: int
    record_type: str
    before_data: Optional[Any] = None
    after_data: Optional[Any] = None
    change_reason: Optional[str] = None
    operator: str
    created_at: datetime

    class Config:
        from_attributes = True


class StudentFullProfileResponse(BaseModel):
    student: StudentResponse
    academic_record: Optional[AcademicRecordResponse] = None
    disciplines: List[DisciplineResponse] = []
    theses: List[ThesisResponse] = []
    latest_pre_review: Optional[PreReviewDetailResponse] = None
    history: List[HistoryRecordResponse] = []


class PreReviewCalculateRequest(BaseModel):
    student_ids: Optional[List[int]] = None
    force_recalculate: bool = False
    operator: str = "system"


class ManualReviewRequest(BaseModel):
    status: PreReviewStatus
    reason: str
    operator: str


class BatchTaskCreate(BaseModel):
    task_type: str
    parameters: Optional[Dict[str, Any]] = None


class BatchTaskResponse(BaseModel):
    id: int
    task_id: str
    task_type: str
    status: TaskStatus
    total_count: int
    success_count: int
    failed_count: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BatchSubtaskResponse(BaseModel):
    id: int
    subtask_id: str
    target_type: str
    target_id: int
    status: TaskStatus
    error_message: Optional[str] = None
    retry_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class PreReviewReportSummary(BaseModel):
    total_students: int
    eligible_count: int
    ineligible_count: int
    pending_count: int
    manually_approved_count: int
    manually_rejected_count: int
    missing_items_by_category: Dict[str, int]
    top_missing_items: List[Dict[str, Any]]


class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    page_size: int
    total_pages: int
