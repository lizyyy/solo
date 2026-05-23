from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from app.models import UserRole, RecordSource, RecordStatus, RetryCategory


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class UserBase(BaseModel):
    username: str
    full_name: Optional[str] = None
    role: UserRole


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CleaningRecordBase(BaseModel):
    source: RecordSource
    source_id: Optional[str] = None
    room_no: Optional[str] = None
    guest_name: Optional[str] = None
    checkin_date: Optional[datetime] = None
    checkout_date: Optional[datetime] = None
    cleaning_type: Optional[str] = None
    linen_change: bool = False
    is_continuous_stay: bool = False
    temp_checkout: bool = False
    price: Optional[float] = None
    content: Optional[str] = None
    raw_data: Optional[str] = None


class CleaningRecordCreate(CleaningRecordBase):
    pass


class CleaningRecordResponse(CleaningRecordBase):
    id: int
    record_no: str
    status: RecordStatus
    retry_category: Optional[RetryCategory] = None
    retry_count: int
    max_retries: int
    last_error: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    reviewed_by: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    review_comment: Optional[str] = None
    is_valid: bool
    validation_errors: Optional[str] = None

    class Config:
        from_attributes = True


class CleaningRecordDetail(CleaningRecordResponse):
    operations: List["OperationLogResponse"] = []
    retries: List["RetryQueueResponse"] = []
    compensations: List["CompensationResponse"] = []


class RetryQueueBase(BaseModel):
    record_id: int
    scheduled_at: datetime


class RetryQueueResponse(BaseModel):
    id: int
    record_id: int
    retry_number: int
    scheduled_at: datetime
    executed_at: Optional[datetime] = None
    status: RecordStatus
    error_message: Optional[str] = None
    result: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class OperationLogBase(BaseModel):
    action: str
    comment: Optional[str] = None


class OperationLogResponse(BaseModel):
    id: int
    record_id: Optional[int] = None
    user_id: Optional[int] = None
    action: str
    old_status: Optional[RecordStatus] = None
    new_status: Optional[RecordStatus] = None
    comment: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True


class CompensationBase(BaseModel):
    record_id: int
    amount: float
    reason: Optional[str] = None


class CompensationResponse(BaseModel):
    id: int
    record_id: int
    amount: float
    reason: Optional[str] = None
    processed_by: Optional[int] = None
    status: str
    created_at: datetime
    processed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class StatusUpdateRequest(BaseModel):
    status: RecordStatus
    comment: Optional[str] = None
    retry_category: Optional[RetryCategory] = None


class ManualReviewRequest(BaseModel):
    comment: str
    approve: bool
    retry_category: Optional[RetryCategory] = None


class CompensationCreate(BaseModel):
    amount: float
    reason: str


class FailedRecordResponse(BaseModel):
    id: int
    record_no: str
    source: RecordSource
    room_no: Optional[str] = None
    status: RecordStatus
    retry_category: Optional[RetryCategory] = None
    retry_count: int
    last_error: Optional[str] = None
    created_at: datetime


class ReportSummary(BaseModel):
    total_records: int
    success_count: int
    failed_count: int
    pending_count: int
    retrying_count: int
    manual_review_count: int
    dead_letter_count: int
    compensated_count: int
    closed_count: int


class RetryCategoryStats(BaseModel):
    category: RetryCategory
    count: int
    success_rate: float


class ManagerDashboard(BaseModel):
    summary: ReportSummary
    retry_categories: List[RetryCategoryStats]
    dead_letter_records: List[FailedRecordResponse]
    pending_retry_records: List[FailedRecordResponse]


CleaningRecordDetail.model_rebuild()
