from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from models import BatchStatus, ReceiptStatus, SourceType, OperationType

class BatchBase(BaseModel):
    name: str
    source_type: SourceType
    operator: str
    store_code: Optional[str] = None
    remark: Optional[str] = None

class BatchCreate(BatchBase):
    pass

class BatchUpdate(BaseModel):
    name: Optional[str] = None
    remark: Optional[str] = None

class BatchResponse(BatchBase):
    id: int
    batch_no: str
    status: BatchStatus
    is_frozen: bool
    frozen_at: Optional[datetime] = None
    frozen_by: Optional[str] = None
    frozen_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class BatchDetail(BatchResponse):
    receipt_count: int
    confirmed_count: int
    disputed_count: int
    pending_count: int

class ReceiptBase(BaseModel):
    room_no: Optional[str] = None
    guest_name: Optional[str] = None
    check_in_date: Optional[datetime] = None
    check_out_date: Optional[datetime] = None
    scheduled_clean_date: Optional[datetime] = None
    actual_clean_date: Optional[datetime] = None
    exception_type: Optional[str] = None
    exception_desc: Optional[str] = None

class ReceiptCreate(ReceiptBase):
    receipt_no: str
    source_file: Optional[str] = None
    source_row_no: Optional[int] = None
    source_raw_data: Optional[Dict[str, Any]] = None
    parsed_data: Optional[Dict[str, Any]] = None

class ReceiptImportItem(BaseModel):
    receipt_no: str
    room_no: Optional[str] = None
    guest_name: Optional[str] = None
    check_in_date: Optional[str] = None
    check_out_date: Optional[str] = None
    scheduled_clean_date: Optional[str] = None
    actual_clean_date: Optional[str] = None
    exception_type: Optional[str] = None
    exception_desc: Optional[str] = None
    source_row_no: Optional[int] = None
    source_raw_data: Optional[Dict[str, Any]] = None

class ReceiptReview(BaseModel):
    review_result: str
    review_reason: str
    reviewed_by: str

class ReceiptOverrule(BaseModel):
    overrule_reason: str
    overruled_by: str
    new_status: ReceiptStatus

class ReceiptResponse(BaseModel):
    id: int
    batch_id: int
    receipt_no: str
    room_no: Optional[str] = None
    guest_name: Optional[str] = None
    check_in_date: Optional[datetime] = None
    check_out_date: Optional[datetime] = None
    scheduled_clean_date: Optional[datetime] = None
    actual_clean_date: Optional[datetime] = None
    exception_type: Optional[str] = None
    exception_desc: Optional[str] = None
    status: ReceiptStatus
    source_file: Optional[str] = None
    source_row_no: Optional[int] = None
    source_raw_data: Optional[Dict[str, Any]] = None
    parsed_data: Optional[Dict[str, Any]] = None
    review_result: Optional[str] = None
    review_reason: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    is_manual_overruled: bool
    overrule_reason: Optional[str] = None
    overruled_by: Optional[str] = None
    overruled_at: Optional[datetime] = None
    before_freeze_status: Optional[str] = None
    after_freeze_status: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class AttachmentCreate(BaseModel):
    file_name: str
    file_path: str
    file_size: Optional[int] = None
    file_type: Optional[str] = None
    source_type: Optional[SourceType] = None
    uploaded_by: str
    remark: Optional[str] = None

class AttachmentResponse(BaseModel):
    id: int
    batch_id: Optional[int] = None
    receipt_id: Optional[int] = None
    file_name: str
    file_path: str
    file_size: Optional[int] = None
    file_type: Optional[str] = None
    source_type: Optional[str] = None
    uploaded_by: str
    remark: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class OperationLogResponse(BaseModel):
    id: int
    batch_id: Optional[int] = None
    receipt_id: Optional[int] = None
    operation_type: str
    operator: str
    operation_time: datetime
    before_state: Optional[Dict[str, Any]] = None
    after_state: Optional[Dict[str, Any]] = None
    diff_summary: Optional[Dict[str, Any]] = None
    remark: Optional[str] = None

    class Config:
        from_attributes = True

class DiffRecordResponse(BaseModel):
    id: int
    batch_id: int
    receipt_id: Optional[int] = None
    operation_type: str
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    changed_by: Optional[str] = None
    changed_at: datetime
    change_reason: Optional[str] = None

    class Config:
        from_attributes = True

class ImportResult(BaseModel):
    success: int
    failed: int
    total: int
    failed_items: List[Dict[str, Any]]

class BatchFreeze(BaseModel):
    frozen_by: str
    frozen_reason: str

class BatchWithdraw(BaseModel):
    operator: str
    reason: str

class ExportSummary(BaseModel):
    batch_no: str
    batch_name: str
    total_receipts: int
    before_freeze: Dict[str, int]
    after_freeze: Dict[str, int]
    manual_overruled_count: int
    manual_reasons: List[Dict[str, Any]]
    export_time: datetime
    exported_by: str
