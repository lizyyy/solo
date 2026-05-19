from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class CompensationType(str, Enum):
    REFUND = "refund"
    EXCHANGE = "exchange"
    COUPON = "coupon"


class OrderStatus(str, Enum):
    PENDING = "pending"
    REVIEWED = "reviewed"
    EXPORTED = "exported"


class OrderImport(BaseModel):
    order_no: str = Field(..., max_length=50)
    group_leader: str = Field(..., max_length=100)
    customer_name: Optional[str] = Field(None, max_length=100)
    customer_phone: Optional[str] = Field(None, max_length=20)
    product_name: str = Field(..., max_length=200)
    product_sku: Optional[str] = Field(None, max_length=50)
    order_quantity: int = Field(..., gt=0)
    order_amount: float = Field(..., gt=0)
    actual_quantity: Optional[int] = None
    actual_amount: Optional[float] = None
    compensation_type: Optional[CompensationType] = None
    compensation_amount: Optional[float] = None
    coupon_code: Optional[str] = Field(None, max_length=50)
    coupon_expire_date: Optional[datetime] = None
    operator: Optional[str] = Field(None, max_length=50)


class OrderQuery(BaseModel):
    group_leader: Optional[str] = None
    status: Optional[OrderStatus] = None
    is_pass: Optional[bool] = None
    rule_type: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


class OrderReview(BaseModel):
    is_pass: bool
    review_reason: str
    operator: str


class ReviewLogResponse(BaseModel):
    id: int
    rule_name: str
    rule_type: str
    is_pass: bool
    reason: str
    detail: Optional[str]
    operator: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    id: int
    order_no: str
    group_leader: str
    customer_name: Optional[str]
    customer_phone: Optional[str]
    product_name: str
    product_sku: Optional[str]
    order_quantity: int
    order_amount: float
    actual_quantity: Optional[int]
    actual_amount: Optional[float]
    compensation_type: Optional[str]
    compensation_amount: Optional[float]
    coupon_code: Optional[str]
    coupon_expire_date: Optional[datetime]
    status: str
    is_pass: Optional[bool]
    review_reason: Optional[str]
    import_batch_no: Optional[str]
    operator: Optional[str]
    created_at: datetime
    updated_at: datetime
    review_logs: List[ReviewLogResponse]

    class Config:
        from_attributes = True


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[OrderResponse]


class SummaryResponse(BaseModel):
    total_count: int
    pass_count: int
    reject_count: int
    pass_rate: float
    total_compensation_amount: float
    rule_breakdown: dict


class BatchImportResponse(BaseModel):
    batch_no: str
    total_count: int
    success_count: int
    failed_count: int
    errors: List[dict]
