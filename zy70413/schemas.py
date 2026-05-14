from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import enum


class BatchStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    PARTIAL_SUCCESS = "partial_success"
    SUCCESS = "success"
    FAILED = "failed"
    CONFLICT = "conflict"


class DetailStatus(str, enum.Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


class RenewalTransaction(BaseModel):
    sequence_no: int
    member_id: str
    transaction_no: str
    transaction_time: datetime
    amount: float
    transaction_type: str = "renewal"
    extra_data: Optional[dict] = None


class BatchSubmitRequest(BaseModel):
    batch_no: str
    caller: str
    transactions: List[RenewalTransaction]
    remark: Optional[str] = None
    rule_version: Optional[str] = None


class BatchSubmitResponse(BaseModel):
    success: bool
    batch_no: str
    status: str
    message: str
    is_duplicate: bool = False
    total_count: int = 0
    success_count: int = 0
    failed_count: int = 0
    details: Optional[List[dict]] = None


class BatchDetailResponse(BaseModel):
    id: int
    sequence_no: int
    member_id: str
    transaction_no: str
    transaction_time: datetime
    amount: float
    status: str
    error_message: Optional[str]
    is_time_order_error: bool
    verification_result: Optional[str]


class BatchResponse(BaseModel):
    batch_no: str
    caller: str
    total_count: int
    success_count: int
    failed_count: int
    status: str
    rule_version: Optional[str]
    submitted_at: datetime
    completed_at: Optional[datetime]
    remark: Optional[str]
    details: Optional[List[BatchDetailResponse]] = None


class ManualNoteCreate(BaseModel):
    batch_no: str
    detail_id: Optional[int] = None
    caller: str
    note_content: str
    created_by: Optional[str] = None
    note_type: Optional[str] = None


class ManualNoteResponse(BaseModel):
    id: int
    batch_no: str
    detail_id: Optional[int]
    caller: str
    note_content: str
    created_by: Optional[str]
    created_at: datetime
    note_type: Optional[str]


class ExportRequest(BaseModel):
    batch_no: str
    export_type: str = "excel"
    include_failed_only: bool = False
    created_by: Optional[str] = None


class ExportResponse(BaseModel):
    success: bool
    task_no: str
    file_path: Optional[str]
    message: str


class RuleCreate(BaseModel):
    version: str
    rule_name: str
    description: Optional[str] = None
    rule_config: str
    is_active: bool = True
    created_by: Optional[str] = None


class RuleResponse(BaseModel):
    version: str
    rule_name: str
    description: Optional[str]
    is_active: bool
    created_at: datetime
