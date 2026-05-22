from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from .models import (
    ReceiptStatus, TaskStatus, DuplicateAction, AttachmentType
)


class BatchCreate(BaseModel):
    batch_id: Optional[str] = None
    pharmacy_id: str
    pharmacy_name: str
    region: str
    created_by: str
    description: Optional[str] = None
    duplicate_action: DuplicateAction = DuplicateAction.IGNORE


class BatchResponse(BaseModel):
    id: str
    pharmacy_id: str
    pharmacy_name: str
    region: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    description: Optional[str]
    total_receipts: int
    status: ReceiptStatus
    frozen_at: Optional[datetime]
    frozen_by: Optional[str]

    class Config:
        from_attributes = True


class ReceiptCreate(BaseModel):
    idempotency_key: Optional[str] = None
    medicine_code: str
    medicine_name: str
    specification: Optional[str] = None
    batch_number: str
    expiry_date: datetime
    quantity: int
    unit: str
    original_price: float
    adjusted_price: Optional[float] = None
    source_type: str
    metadata: Optional[Dict[str, Any]] = None


class ReceiptResponse(BaseModel):
    id: str
    batch_id: str
    idempotency_key: str
    medicine_code: str
    medicine_name: str
    specification: Optional[str]
    batch_number: str
    expiry_date: datetime
    quantity: int
    unit: str
    original_price: float
    adjusted_price: Optional[float]
    source_type: str
    status: ReceiptStatus
    review_reason: Optional[str]
    review_by: Optional[str]
    review_at: Optional[datetime]
    freeze_reason: Optional[str]
    created_at: datetime
    updated_at: datetime
    version: int
    previous_status: Optional[ReceiptStatus]

    class Config:
        from_attributes = True


class ReceiptImportResult(BaseModel):
    id: str
    idempotency_key: str
    medicine_name: str
    action_taken: str
    status: ReceiptStatus
    version: int


class BatchImportRequest(BaseModel):
    receipts: List[ReceiptCreate]
    duplicate_action: DuplicateAction = DuplicateAction.IGNORE


class BatchImportResponse(BaseModel):
    batch_id: str
    total_processed: int
    created: int
    updated: int
    ignored: int
    results: List[ReceiptImportResult]


class ReviewRequest(BaseModel):
    receipt_ids: Optional[List[str]] = None
    approved: bool
    reason: Optional[str] = None
    reviewed_by: str


class FreezeRequest(BaseModel):
    receipt_ids: Optional[List[str]] = None
    reason: str
    frozen_by: str


class UnfreezeRequest(BaseModel):
    receipt_ids: Optional[List[str]] = None
    reason: Optional[str] = None
    target_status: ReceiptStatus = ReceiptStatus.APPROVED
    unfrozen_by: str


class ArchiveRequest(BaseModel):
    receipt_ids: Optional[List[str]] = None
    reason: Optional[str] = None
    archived_by: str


class AttachmentResponse(BaseModel):
    id: str
    batch_id: str
    receipt_id: Optional[str]
    attachment_type: AttachmentType
    file_name: str
    file_size: int
    uploaded_by: str
    uploaded_at: datetime
    description: Optional[str]

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    batch_id: Optional[str]
    receipt_id: Optional[str]
    action: str
    actor: str
    action_at: datetime
    old_value: Optional[Dict[str, Any]]
    new_value: Optional[Dict[str, Any]]
    reason: Optional[str]

    class Config:
        from_attributes = True


class StatusTransitionResponse(BaseModel):
    id: int
    receipt_id: str
    from_status: ReceiptStatus
    to_status: ReceiptStatus
    transitioned_by: str
    transitioned_at: datetime
    reason: Optional[str]

    class Config:
        from_attributes = True


class AsyncTaskResponse(BaseModel):
    id: str
    batch_id: Optional[str]
    task_type: str
    status: TaskStatus
    retry_count: int
    max_retries: int
    error_message: Optional[str]
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    next_retry_at: Optional[datetime]

    class Config:
        from_attributes = True


class BatchSummaryResponse(BaseModel):
    batch_id: str
    pharmacy_name: str
    status: ReceiptStatus
    total_receipts: int
    status_breakdown: Dict[str, int]
    frozen_at: Optional[datetime]
    frozen_by: Optional[str]
    created_at: datetime


class ExportRequest(BaseModel):
    batch_ids: Optional[List[str]] = None
    region: Optional[str] = None
    status: Optional[ReceiptStatus] = None
    include_audit_log: bool = False


class ErrorResponse(BaseModel):
    detail: str
    code: str
    timestamp: datetime = Field(default_factory=datetime.now)
