from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class MemberCreate(BaseModel):
    member_no: str = Field(..., max_length=50)
    name: str = Field(..., max_length=100)
    phone: str = Field(..., max_length=20)
    balance: Optional[float] = 0.0
    points: Optional[int] = 0
    points_expire_at: Optional[datetime] = None
    store_id: Optional[str] = None

class MemberResponse(BaseModel):
    id: int
    member_no: str
    name: str
    phone: str
    balance: float
    points: int
    points_expire_at: Optional[datetime]
    store_id: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class TransactionResponse(BaseModel):
    id: int
    type: str
    amount: float
    points: int
    description: Optional[str]
    ref_no: Optional[str]
    operator: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class DuplicateCandidateResponse(BaseModel):
    id: int
    phone: str
    member_ids: str
    reason: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class MergeInitiateRequest(BaseModel):
    source_member_no: str
    target_member_no: str
    reason: Optional[str] = None
    operator: Optional[str] = "system"
    idempotency_key: Optional[str] = None

class MergePreviewRequest(BaseModel):
    source_member_no: str
    target_member_no: str

class MergeReviewRequest(BaseModel):
    merge_no: str
    conflict_type: str
    decision: str
    after_value: Optional[str] = None
    explanation: str
    operator: str = "operator"

class MergeActionRequest(BaseModel):
    merge_no: str
    operator: Optional[str] = "operator"
    remark: Optional[str] = None

class MergeQueryRequest(BaseModel):
    merge_no: Optional[str] = None
    status: Optional[str] = None
    phone: Optional[str] = None

class MergeHistoryResponse(BaseModel):
    id: int
    phase: str
    old_status: Optional[str]
    new_status: str
    operator: Optional[str]
    description: Optional[str]
    change_summary: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class ManualReviewResponse(BaseModel):
    id: int
    conflict_type: str
    before_value: Optional[str]
    after_value: Optional[str]
    decision: str
    operator: Optional[str]
    explanation: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class MergeRecordResponse(BaseModel):
    id: int
    merge_no: str
    source_member_no: str
    target_member_no: str
    status: str
    phase: str
    operator: Optional[str]
    reason: Optional[str]
    remark: Optional[str]
    balance_before: float
    points_before: int
    balance_moved: float
    points_moved: int
    balance_after: float
    points_after: int
    target_balance_before: float
    target_points_before: int
    target_balance_after: float
    target_points_after: int
    idempotency_key: Optional[str]
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]
    cancelled_at: Optional[datetime]
    error_message: Optional[str]

    class Config:
        from_attributes = True

class MergeDetailResponse(BaseModel):
    merge: MergeRecordResponse
    histories: List[MergeHistoryResponse]
    reviews: List[ManualReviewResponse]
    source_member: Optional[MemberResponse]
    target_member: Optional[MemberResponse]
    source_transactions: Optional[List[TransactionResponse]]

class AssetPreview(BaseModel):
    source_member: MemberResponse
    target_member: MemberResponse
    source_balance: float
    source_points: int
    target_balance: float
    target_points: int
    estimated_target_balance: float
    estimated_target_points: int
    conflicts: List[Dict[str, Any]]
    warnings: List[str]
    is_mergeable: bool
    reason_if_not_mergeable: Optional[str]

class ReportGenerateRequest(BaseModel):
    merge_no: str
    report_type: str = "detailed"
    operator: str = "operator"

class ReportResponse(BaseModel):
    id: int
    report_no: str
    merge_record_id: Optional[int]
    report_type: str
    status: str
    content: Optional[str]
    operator: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True

class APIResponse(BaseModel):
    success: bool
    code: str
    message: str
    data: Optional[Any] = None
