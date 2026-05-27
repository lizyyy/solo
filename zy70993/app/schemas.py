from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class BatchBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    month: str = Field(..., pattern=r"^\d{4}-\d{2}$")


class BatchCreate(BatchBase):
    pass


class BatchOut(BatchBase):
    id: int
    idempotency_key: str
    swipe_count: int
    subsidy_count: int
    refund_count: int
    status: str
    note: str
    created_at: datetime

    class Config:
        from_attributes = True


class SwipeItem(BaseModel):
    student_id: str
    student_name: Optional[str] = ""
    swipe_time: datetime
    meal_type: str
    amount: float = 0.0
    device: Optional[str] = ""


class SwipeList(BaseModel):
    items: List[SwipeItem]


class SubsidyItem(BaseModel):
    student_id: str
    student_name: Optional[str] = ""
    monthly_limit: float
    subsidy_type: Optional[str] = ""
    effective_month: str = Field(..., pattern=r"^\d{4}-\d{2}$")
    note: Optional[str] = ""


class SubsidyList(BaseModel):
    items: List[SubsidyItem]


class RefundItem(BaseModel):
    student_id: str
    refund_time: datetime
    refund_amount: float
    related_meal_type: Optional[str] = ""
    reason: Optional[str] = ""


class RefundList(BaseModel):
    items: List[RefundItem]


class UploadResponse(BaseModel):
    batch: BatchOut
    existing: bool
    message: str


class SwipeBrief(BaseModel):
    id: int
    student_id: str
    student_name: str
    swipe_time: datetime
    meal_type: str
    amount: float
    device: str

    class Config:
        from_attributes = True


class ResultItem(BaseModel):
    id: int
    status: str
    reason: str
    suggestion: str
    consumed_before_this: float
    subsidy_limit: float
    source_trace: str
    swipe: Optional[SwipeBrief] = None
    matched_refund_id: Optional[int] = None

    class Config:
        from_attributes = True


class ReconcileReport(BaseModel):
    batch_id: int
    month: str
    total: int
    normal_count: int
    pending_count: int
    failed_count: int
    normal: List[ResultItem]
    pending: List[ResultItem]
    failed: List[ResultItem]
