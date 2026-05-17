from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum


class ErrorCode(str, Enum):
    MISSING_FIELD = "missing_field"
    INVALID_STATUS = "invalid_status"
    REVIEW_REQUIRED = "review_required"
    ALREADY_PROCESSED = "already_processed"
    DUPLICATE_ENTRY = "duplicate_entry"
    NOT_FOUND = "not_found"
    VALIDATION_ERROR = "validation_error"


class ErrorResponse(BaseModel):
    code: ErrorCode
    message: str
    details: Optional[dict] = None


class DeviceBase(BaseModel):
    serial_number: str = Field(..., description="设备序列号")
    brand: Optional[str] = Field(None, description="品牌")
    model: Optional[str] = Field(None, description="型号")
    storage: Optional[str] = Field(None, description="存储容量")
    color: Optional[str] = Field(None, description="颜色")


class DeviceCreate(DeviceBase):
    pass


class DeviceUpdate(BaseModel):
    brand: Optional[str] = None
    model: Optional[str] = None
    storage: Optional[str] = None
    color: Optional[str] = None
    status: Optional[str] = None


class DeviceResponse(DeviceBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InspectionItemBase(BaseModel):
    name: str = Field(..., description="检测项名称")
    category: str = Field(..., description="检测类别")
    max_score: float = Field(10.0, description="最高分")
    weight: float = Field(1.0, description="权重")
    description: Optional[str] = None


class InspectionItemCreate(InspectionItemBase):
    pass


class InspectionItemResponse(InspectionItemBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class InspectionCreate(BaseModel):
    device_id: int
    item_id: int
    score: float = Field(..., ge=0, description="评分")
    inspector: Optional[str] = None
    notes: Optional[str] = None


class InspectionResponse(BaseModel):
    id: int
    device_id: int
    item_id: int
    item_name: str
    score: float
    max_score: float
    inspector: Optional[str]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class QuoteBase(BaseModel):
    device_id: int
    base_price: float = Field(..., gt=0, description="基础报价")
    notes: Optional[str] = None


class QuoteCreate(QuoteBase):
    pass


class QuoteFreezeRequest(BaseModel):
    frozen_by: str


class QuoteResponse(BaseModel):
    id: int
    device_id: int
    serial_number: str
    version: int
    base_price: float
    final_price: Optional[float]
    is_frozen: bool
    frozen_at: Optional[datetime]
    frozen_by: Optional[str]
    status: str
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DeductionReasonBase(BaseModel):
    code: str = Field(..., description="扣减原因代码")
    name: str = Field(..., description="扣减原因名称")
    category: Optional[str] = None
    default_amount: Optional[float] = Field(0, description="默认扣减金额")
    description: Optional[str] = None


class DeductionReasonCreate(DeductionReasonBase):
    pass


class DeductionReasonResponse(DeductionReasonBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class DeductionCreate(BaseModel):
    quote_id: int
    reason_id: int
    amount: float = Field(..., gt=0, description="扣减金额")
    description: Optional[str] = None
    recorded_by: Optional[str] = None


class DeductionResponse(BaseModel):
    id: int
    quote_id: int
    reason_id: int
    reason_code: str
    reason_name: str
    amount: float
    description: Optional[str]
    recorded_by: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_MANUAL = "needs_manual"


class ReviewCreate(BaseModel):
    device_id: int
    quote_id: int


class ReviewUpdate(BaseModel):
    status: ReviewStatus
    reviewer: Optional[str] = None
    review_notes: Optional[str] = None
    resolution: Optional[str] = None


class ReviewResponse(BaseModel):
    id: int
    device_id: int
    quote_id: int
    serial_number: str
    status: str
    reviewer: Optional[str]
    review_notes: Optional[str]
    resolution: Optional[str]
    reviewed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReportGenerateRequest(BaseModel):
    device_id: int
    generated_by: Optional[str] = None


class InspectionReportResponse(BaseModel):
    id: int
    device_id: int
    serial_number: str
    report_number: str
    total_score: Optional[float]
    final_price: Optional[float]
    status: str
    generated_by: Optional[str]
    generated_at: datetime
    content: Optional[str]

    class Config:
        from_attributes = True
