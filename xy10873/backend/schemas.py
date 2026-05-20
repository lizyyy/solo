from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from .models import SubmissionStatus, ExceptionType


class SubmissionBase(BaseModel):
    submission_id: str
    student_id: str
    assignment_id: str
    course_id: str


class SubmissionCreate(SubmissionBase):
    pass


class SubmissionResponse(SubmissionBase):
    id: int
    status: SubmissionStatus
    final_score: Optional[float]
    submit_time: datetime
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class GradingTaskBase(BaseModel):
    task_id: str
    submission_id: str
    grader_type: str


class GradingTaskCreate(GradingTaskBase):
    pass


class GradingTaskResponse(GradingTaskBase):
    id: int
    started_at: datetime
    completed_at: Optional[datetime]
    raw_score: Optional[float]
    grading_details: Optional[str]

    class Config:
        from_attributes = True


class CallbackPayloadBase(BaseModel):
    payload_id: str
    submission_id: str
    raw_payload: str
    signature: str


class CallbackPayloadCreate(CallbackPayloadBase):
    pass


class CallbackPayloadResponse(CallbackPayloadBase):
    id: int
    received_at: datetime
    is_signature_valid: int
    score: Optional[float]
    grade_written: int
    grade_written_at: Optional[datetime]

    class Config:
        from_attributes = True


class ExceptionLogBase(BaseModel):
    exception_id: str
    submission_id: str
    exception_type: ExceptionType
    error_message: str


class ExceptionLogCreate(ExceptionLogBase):
    stack_trace: Optional[str] = None


class ExceptionLogResponse(ExceptionLogBase):
    id: int
    stack_trace: Optional[str]
    occurred_at: datetime
    resolved: int
    resolved_at: Optional[datetime]
    resolved_by: Optional[str]

    class Config:
        from_attributes = True


class RetryRecordBase(BaseModel):
    retry_id: str
    submission_id: str
    retry_type: str
    previous_status: str
    new_status: str
    triggered_by: str


class RetryRecordCreate(RetryRecordBase):
    pass


class RetryRecordResponse(RetryRecordBase):
    id: int
    retry_count: int
    triggered_at: datetime
    success: int

    class Config:
        from_attributes = True


class SubmissionDetailResponse(SubmissionResponse):
    grading_tasks: List[GradingTaskResponse] = []
    callback_payloads: List[CallbackPayloadResponse] = []
    exception_logs: List[ExceptionLogResponse] = []
    retry_records: List[RetryRecordResponse] = []


class StatusUpdateRequest(BaseModel):
    status: SubmissionStatus
    updated_by: str


class CallbackVerifyRequest(BaseModel):
    payload_id: str


class GradeWriteRequest(BaseModel):
    payload_id: str
    score: float


class RetryRequest(BaseModel):
    submission_id: str
    retry_type: str
    triggered_by: str


class StatisticsResponse(BaseModel):
    total_submissions: int
    pending: int
    grading: int
    callback_pending: int
    callback_failed: int
    success: int
    manual_review: int
    total_exceptions: int
    unresolved_exceptions: int


class ExportRequest(BaseModel):
    status: Optional[SubmissionStatus] = None
    course_id: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
