from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class WebhookCreate(BaseModel):
    idempotency_key: str
    signature_key: str
    event_payload: str
    target_url: Optional[str] = None
    max_retries: Optional[int] = 3


class WebhookUpdate(BaseModel):
    status: Optional[str] = None
    error_reason: Optional[str] = None
    processing_report: Optional[str] = None
    is_verified: Optional[bool] = None
    verified_by: Optional[str] = None


class WebhookResponse(BaseModel):
    id: str
    idempotency_key: str
    signature_key: str
    event_payload: str
    status: str
    error_reason: Optional[str]
    retry_count: int
    max_retries: int
    created_at: datetime
    updated_at: datetime
    processed_at: Optional[datetime]
    processing_report: Optional[str]
    is_verified: bool
    verified_by: Optional[str]
    verified_at: Optional[datetime]
    queue_position: Optional[int]
    target_url: Optional[str]

    class Config:
        orm_mode = True


class WebhookFilter(BaseModel):
    status: Optional[str] = None
    signature_key: Optional[str] = None
    idempotency_key: Optional[str] = None
    page: int = 1
    page_size: int = 20


class VerifyRequest(BaseModel):
    record_id: str
    verified_by: str
    notes: Optional[str] = None


class RetryRequest(BaseModel):
    record_id: str
    force: Optional[bool] = False


class ExportRequest(BaseModel):
    status: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
