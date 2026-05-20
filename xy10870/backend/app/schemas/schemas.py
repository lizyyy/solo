from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from ..models.models import RequestStatus


class LanguageEnvironmentBase(BaseModel):
    name: str
    version: Optional[str] = None
    container_image: Optional[str] = None
    timeout_seconds: int = 30
    memory_limit_mb: int = 512
    cpu_limit: float = 1.0
    is_enabled: bool = True


class LanguageEnvironmentCreate(LanguageEnvironmentBase):
    pass


class LanguageEnvironment(LanguageEnvironmentBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class StudentBase(BaseModel):
    student_id: str
    name: str
    email: Optional[str] = None
    quota_per_window: int = 10
    is_active: bool = True


class StudentCreate(StudentBase):
    pass


class Student(StudentBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class QuotaWindowBase(BaseModel):
    student_id: int
    window_start: datetime
    window_end: datetime
    used_quota: int = 0
    max_quota: int = 10


class QuotaWindowCreate(QuotaWindowBase):
    pass


class QuotaWindow(QuotaWindowBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class StatusHistoryBase(BaseModel):
    from_status: Optional[str] = None
    to_status: str
    message: Optional[str] = None


class StatusHistoryCreate(StatusHistoryBase):
    request_id: int


class StatusHistory(StatusHistoryBase):
    id: int
    request_id: int
    timestamp: datetime

    class Config:
        from_attributes = True


class TimeoutRecordBase(BaseModel):
    timeout_after_seconds: int
    was_forced: bool = True
    reason: Optional[str] = None


class TimeoutRecordCreate(TimeoutRecordBase):
    request_id: int
    student_id: int


class TimeoutRecord(TimeoutRecordBase):
    id: int
    request_id: int
    student_id: int
    timeout_at: datetime

    class Config:
        from_attributes = True


class RunRequestBase(BaseModel):
    student_id: int
    language_id: int
    code_snippet: str
    input_data: Optional[str] = None
    priority: int = 0


class RunRequestCreate(RunRequestBase):
    pass


class RunRequestUpdate(BaseModel):
    status: Optional[str] = None
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    exit_code: Optional[int] = None
    error_message: Optional[str] = None
    execution_time_ms: Optional[int] = None
    memory_usage_kb: Optional[int] = None


class RunRequest(RunRequestBase):
    id: int
    request_id: str
    status: str
    merged_from: Optional[str] = None
    container_id: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    execution_time_ms: Optional[int] = None
    memory_usage_kb: Optional[int] = None
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    exit_code: Optional[int] = None
    error_message: Optional[str] = None
    created_by_manual: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    status_history: List[StatusHistory] = []
    student: Optional[Student] = None
    language: Optional[LanguageEnvironment] = None

    class Config:
        from_attributes = True


class ResultSummaryBase(BaseModel):
    date: datetime
    total_requests: int = 0
    successful: int = 0
    failed: int = 0
    timed_out: int = 0
    merged: int = 0
    avg_execution_time_ms: float = 0.0
    total_execution_time_ms: int = 0
    peak_concurrent_containers: int = 0
    quota_exceeded_count: int = 0


class ResultSummaryCreate(ResultSummaryBase):
    pass


class ResultSummary(ResultSummaryBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BatchImportItem(BaseModel):
    student_id: str
    language: str
    code_snippet: str
    input_data: Optional[str] = None


class BatchImportRequest(BaseModel):
    items: List[BatchImportItem]


class QuotaCheckResponse(BaseModel):
    student_id: str
    has_quota: bool
    used_quota: int
    max_quota: int
    window_end: datetime


class RunRequestListResponse(BaseModel):
    items: List[RunRequest]
    total: int
    page: int
    page_size: int


class ReportData(BaseModel):
    date_range: str
    total_requests: int
    success_rate: float
    avg_execution_time: float
    top_students: List[dict]
    language_distribution: List[dict]
    daily_stats: List[dict]
