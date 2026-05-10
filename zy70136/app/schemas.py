from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from app.models import (
    SignStatus, QualificationStatus, ReceiptStatus, 
    RetryType, RetryStatus
)


class CreateSignApplicationRequest(BaseModel):
    merchant_id: str = Field(..., min_length=1, max_length=64)
    sign_name: str = Field(..., min_length=1, max_length=32)
    sign_type: Optional[str] = None
    description: Optional[str] = None
    request_id: str = Field(..., min_length=1, max_length=64)


class SignApplicationResponse(BaseModel):
    id: int
    request_id: str
    merchant_id: str
    sign_name: str
    sign_type: Optional[str]
    status: SignStatus
    channel_sign_id: Optional[str]
    channel: Optional[str]
    audit_comment: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class UploadQualificationRequest(BaseModel):
    application_id: int
    qualification_type: str
    file_name: str
    file_url: str
    file_hash: str
    request_id: str


class QualificationResponse(BaseModel):
    id: int
    request_id: str
    application_id: int
    qualification_type: str
    file_name: str
    status: QualificationStatus
    review_comment: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class ChannelSubmitRequest(BaseModel):
    application_id: int
    channel: str
    request_id: str


class ChannelReceiptRequest(BaseModel):
    application_id: int
    channel: str
    channel_receipt_id: str
    raw_payload: str
    request_id: str


class RetryQueueResponse(BaseModel):
    id: int
    request_id: str
    retry_type: RetryType
    target_id: str
    status: RetryStatus
    retry_count: int
    max_retry_count: int
    next_retry_at: Optional[datetime]
    last_error: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class AuditReportResponse(BaseModel):
    id: int
    report_id: str
    application_id: int
    final_status: str
    qualification_result: Optional[str]
    channel_result: Optional[str]
    generated_at: datetime
    
    class Config:
        from_attributes = True


class IdempotentCheckResult(BaseModel):
    is_duplicate: bool
    existing_request_id: Optional[str]
    existing_status: Optional[str]
    message: str
