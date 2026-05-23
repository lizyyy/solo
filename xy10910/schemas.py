from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from models import DeviceStatus, ReviewStatus, DeductionType


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
    status: Optional[DeviceStatus] = None


class DeviceResponse(DeviceBase):
    id: int
    status: DeviceStatus
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class DeductionBase(BaseModel):
    deduction_type: DeductionType
    description: str
    amount: float


class DeductionCreate(DeductionBase):
    pass


class DeductionResponse(DeductionBase):
    id: int
    inspection_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class InspectionBase(BaseModel):
    inspector: str
    screen_score: float = Field(100.0, ge=0, le=100)
    battery_score: float = Field(100.0, ge=0, le=100)
    appearance_score: float = Field(100.0, ge=0, le=100)
    function_score: float = Field(100.0, ge=0, le=100)
    remarks: Optional[str] = None


class InspectionCreate(InspectionBase):
    serial_number: str
    deductions: List[DeductionCreate] = Field(default_factory=list)


class InspectionResponse(InspectionBase):
    id: int
    device_id: int
    total_score: float
    created_at: datetime
    deductions: List[DeductionResponse]

    class Config:
        from_attributes = True


class QuoteBase(BaseModel):
    initial_price: float
    quoted_by: str
    remarks: Optional[str] = None


class QuoteCreate(QuoteBase):
    serial_number: str


class QuoteResponse(QuoteBase):
    id: int
    device_id: int
    version: int
    final_price: Optional[float]
    is_frozen: bool
    frozen_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewBase(BaseModel):
    reviewer: str
    comments: Optional[str] = None


class ReviewCreate(ReviewBase):
    serial_number: str


class ReviewUpdate(BaseModel):
    status: ReviewStatus
    comments: Optional[str] = None


class ReviewResponse(ReviewBase):
    id: int
    device_id: int
    status: ReviewStatus
    reviewed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class StatusHistoryResponse(BaseModel):
    id: int
    device_id: int
    from_status: Optional[str]
    to_status: str
    operator: Optional[str]
    remarks: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class DeviceDetailResponse(DeviceResponse):
    inspections: List[InspectionResponse]
    quotes: List[QuoteResponse]
    reviews: List[ReviewResponse]
    status_history: List[StatusHistoryResponse]


class ExceptionLogResponse(BaseModel):
    id: int
    serial_number: Optional[str]
    endpoint: str
    raw_input: str
    error_message: str
    resolution: Optional[str]
    resolved: bool
    resolved_by: Optional[str]
    resolved_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class ExceptionLogResolve(BaseModel):
    resolution: str
    resolved_by: str


class ReportGenerate(BaseModel):
    serial_number: str
    generated_by: str


class ReportResponse(BaseModel):
    id: int
    device_id: int
    report_number: str
    content: str
    generated_at: datetime
    generated_by: str

    class Config:
        from_attributes = True


class StatusTransition(BaseModel):
    serial_number: str
    target_status: DeviceStatus
    operator: str
    remarks: Optional[str] = None


class ManualCorrection(BaseModel):
    serial_number: str
    correction_type: str
    correction_value: str
    operator: str
    reason: str
