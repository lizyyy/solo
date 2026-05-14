from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class TaskStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    ROLLED_BACK = "rolled_back"
    COMPLETED = "completed"

class CrawlerTaskCreate(BaseModel):
    task_id: str
    idempotency_key: str
    target_site: str
    proxy_pool: str
    version: Optional[str] = None
    frequency_strategy: Optional[str] = None

class CrawlerTaskResponse(BaseModel):
    id: int
    task_id: str
    target_site: str
    proxy_pool: str
    status: str
    version: Optional[str]
    frequency_strategy: Optional[str]
    created_at: datetime
    updated_at: datetime
    approved_by: Optional[str]
    approved_at: Optional[datetime]
    rolled_back_from: Optional[int]

    class Config:
        from_attributes = True

class FailureReasonResponse(BaseModel):
    id: int
    task_id: int
    reason_type: str
    description: str
    count: int
    first_occurred_at: datetime
    last_occurred_at: datetime

    class Config:
        from_attributes = True

class CaptchaEventCreate(BaseModel):
    task_id: str
    event_type: str
    captcha_type: str

class CaptchaEventResponse(BaseModel):
    id: int
    task_id: int
    event_type: str
    captcha_type: str
    confirmed: bool
    confirmed_by: Optional[str]
    confirmed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True

class FrequencyAnomalyResponse(BaseModel):
    id: int
    task_id: int
    anomaly_type: str
    current_rate: float
    expected_rate: float
    threshold: float
    detected_at: datetime
    resolved: bool

    class Config:
        from_attributes = True

class CollectionReportResponse(BaseModel):
    id: int
    task_id: int
    total_requests: int
    success_count: int
    failure_count: int
    success_rate: float
    avg_response_time: float
    data_records: int
    report_date: datetime

    class Config:
        from_attributes = True

class TaskDetailResponse(CrawlerTaskResponse):
    failure_reasons: List[FailureReasonResponse] = []
    captcha_events: List[CaptchaEventResponse] = []
    frequency_anomalies: List[FrequencyAnomalyResponse] = []
    collection_reports: List[CollectionReportResponse] = []

class ApproveRequest(BaseModel):
    approved_by: str

class RollbackRequest(BaseModel):
    rolled_back_from: int

class CaptchaConfirmRequest(BaseModel):
    confirmed_by: str