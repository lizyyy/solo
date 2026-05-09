from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class ReceiptInfo(BaseModel):
    receipt_index: str
    original_transaction_id: str
    transaction_type: str
    transaction_amount: int
    transaction_date: datetime
    counterparty_name: str
    payer_name: str


class PermissionRequest(BaseModel):
    customer_id: str
    receipt_index: str
    operator_id: str
    operator_name: str
    request_reason: Optional[str] = None
    max_download_count: int = Field(default=3, ge=1, le=10)
    valid_days: int = Field(default=30, ge=1, le=365)


class DownloadRequest(BaseModel):
    permission_id: str
    receipt_index: str
    customer_id: str
    operator_id: str
    operator_name: str
    client_ip: Optional[str] = None
    user_agent: Optional[str] = None


class DownloadResult(BaseModel):
    success: bool
    receipt_index: str
    download_seq: Optional[int] = None
    watermark_info: Optional[str] = None
    error_message: Optional[str] = None


class ValidationResult(BaseModel):
    valid: bool
    errors: List[str] = []
    warnings: List[str] = []


class SignatureValidationResult(BaseModel):
    valid: bool
    receipt_index: str
    original_transaction_id: str
    signature_verified: bool
    transaction_consistent: bool


class BatchDownloadRequest(BaseModel):
    permission_ids: List[str]
    customer_id: str
    operator_id: str
    operator_name: str
    client_ip: Optional[str] = None


class ExportRequest(BaseModel):
    customer_id: str
    start_date: datetime
    end_date: datetime
    export_type: str = Field(default="REPRINT_SUMMARY")
    operator_id: str
    operator_name: str


class ExportItem(BaseModel):
    receipt_index: str
    original_transaction_id: str
    transaction_date: datetime
    transaction_type: str
    transaction_amount: int
    counterparty_name: str
    reprint_count: int
    last_download_at: Optional[datetime] = None
    last_operator: Optional[str] = None


class AuditRecord(BaseModel):
    audit_id: str
    operation_type: str
    operator_id: str
    operator_name: str
    receipt_index: Optional[str]
    operation_result: str
    operated_at: datetime