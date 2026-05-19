from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class ChapterUnlockBase(BaseModel):
    chapter_id: str
    chapter_name: str
    chapter_order: int
    is_unlocked: bool = False
    is_completed: bool = False
    unlock_date: Optional[datetime] = None
    completion_date: Optional[datetime] = None
    completion_percentage: float = 0.0


class ChapterUnlockCreate(ChapterUnlockBase):
    pass


class ChapterUnlockUpdate(BaseModel):
    is_unlocked: Optional[bool] = None
    is_completed: Optional[bool] = None
    completion_percentage: Optional[float] = None


class ChapterUnlockResponse(ChapterUnlockBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class QuizScoreBase(BaseModel):
    quiz_id: str
    quiz_name: str
    chapter_id: Optional[str] = None
    attempt_count: int = 0
    highest_score: float = 0.0
    latest_score: float = 0.0
    passing_score: float = 60.0
    is_passed: bool = False
    first_attempt_date: Optional[datetime] = None
    latest_attempt_date: Optional[datetime] = None


class QuizScoreCreate(QuizScoreBase):
    pass


class QuizScoreUpdate(BaseModel):
    latest_score: Optional[float] = None
    attempt_count: Optional[int] = None


class QuizScoreResponse(QuizScoreBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RemedialTaskBase(BaseModel):
    task_id: str
    task_name: str
    task_type: str
    reason: str
    is_abnormal: bool = False
    abnormal_reason: Optional[str] = None
    status: str = "pending"
    assigned_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    completion_date: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    review_notes: Optional[str] = None


class RemedialTaskCreate(RemedialTaskBase):
    pass


class RemedialTaskUpdate(BaseModel):
    status: Optional[str] = None
    is_abnormal: Optional[bool] = None
    abnormal_reason: Optional[str] = None
    reviewed_by: Optional[str] = None
    review_notes: Optional[str] = None


class RemedialTaskResponse(RemedialTaskBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StudentProgressBase(BaseModel):
    student_id: str
    student_name: str
    course_id: str
    course_name: str
    overall_progress: float = 0.0
    total_chapters: int = 0
    completed_chapters: int = 0
    total_quizzes: int = 0
    passed_quizzes: int = 0
    start_date: Optional[datetime] = None
    last_activity_date: Optional[datetime] = None
    expected_completion_date: Optional[datetime] = None
    status: str = "in_progress"


class StudentProgressCreate(StudentProgressBase):
    chapters: List[ChapterUnlockCreate] = []
    quizzes: List[QuizScoreCreate] = []
    remedial_tasks: List[RemedialTaskCreate] = []
    request_id: Optional[str] = None


class StudentProgressUpdate(BaseModel):
    overall_progress: Optional[float] = None
    completed_chapters: Optional[int] = None
    passed_quizzes: Optional[int] = None
    status: Optional[str] = None
    last_activity_date: Optional[datetime] = None


class StudentProgressResponse(StudentProgressBase):
    id: int
    chapters: List[ChapterUnlockResponse] = []
    quizzes: List[QuizScoreResponse] = []
    remedial_tasks: List[RemedialTaskResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StudentProgressListResponse(BaseModel):
    total: int
    items: List[StudentProgressResponse]


class CertificateEligibilityBase(BaseModel):
    student_id: str
    student_name: str
    course_id: str
    course_name: str
    is_eligible: bool = False
    eligibility_criteria: Optional[Dict[str, Any]] = None
    manual_confirmation: bool = False
    confirmed_by: Optional[str] = None
    confirmation_date: Optional[datetime] = None
    confirmation_notes: Optional[str] = None
    certificate_issued: bool = False
    certificate_issue_date: Optional[datetime] = None
    certificate_number: Optional[str] = None


class CertificateEligibilityCreate(CertificateEligibilityBase):
    pass


class CertificateEligibilityUpdate(BaseModel):
    is_eligible: Optional[bool] = None
    manual_confirmation: Optional[bool] = None
    confirmed_by: Optional[str] = None
    confirmation_notes: Optional[str] = None
    certificate_issued: Optional[bool] = None


class CertificateEligibilityResponse(CertificateEligibilityBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProgressFilterParams(BaseModel):
    student_id: Optional[str] = None
    course_id: Optional[str] = None
    status: Optional[str] = None
    has_abnormal_tasks: Optional[bool] = None
    start_date_from: Optional[datetime] = None
    start_date_to: Optional[datetime] = None
    page: int = 1
    page_size: int = 20


class ReviewRemedialTaskRequest(BaseModel):
    task_id: int
    status: str
    is_abnormal: bool
    abnormal_reason: Optional[str] = None
    reviewed_by: str
    review_notes: Optional[str] = None


class ConfirmCertificateRequest(BaseModel):
    eligibility_id: int
    is_eligible: bool
    confirmed_by: str
    confirmation_notes: Optional[str] = None


class CreateCertificateRequest(BaseModel):
    student_id: str
    student_name: str
    course_id: str
    course_name: str
    is_eligible: bool = False
    eligibility_criteria: Optional[Dict[str, Any]] = None


class CreateCertificateFromProgressRequest(BaseModel):
    progress_id: int
    confirmed_by: Optional[str] = None


class IssueCertificateRequest(BaseModel):
    eligibility_id: int
    certificate_number: str


class PublishProgressRequest(BaseModel):
    progress_id: int
    published_by: str
    notes: Optional[str] = None


class ExportRequest(BaseModel):
    export_type: str
    filters: Optional[Dict[str, Any]] = None
    file_format: str = "xlsx"


class LearningReportResponse(BaseModel):
    id: int
    report_id: str
    report_type: str
    report_name: str
    generated_by: Optional[str] = None
    generated_at: datetime
    file_path: str
    file_size: Optional[int] = None
    record_count: Optional[int] = None
    status: str

    class Config:
        from_attributes = True


class OperationLogResponse(BaseModel):
    id: int
    operation_type: str
    operator: Optional[str] = None
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None
    request_id: Optional[str] = None
