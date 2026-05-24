from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from datetime import datetime
from app.models import BlastStatus, NoticeType, AuditAction
from enum import Enum


class ErrorCode(str, Enum):
    MISSING_DATA = "MISSING_DATA"
    INVALID_STATUS = "INVALID_STATUS"
    DUPLICATE_REQUEST = "DUPLICATE_REQUEST"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    WIND_CHECK_FAILED = "WIND_CHECK_FAILED"
    RECEIPT_MISSING = "RECEIPT_MISSING"
    ZONE_CHANGED = "ZONE_CHANGED"
    NOT_FOUND = "NOT_FOUND"
    VALIDATION_ERROR = "VALIDATION_ERROR"


class WarningZoneBase(BaseModel):
    zone_name: str = Field(..., max_length=100)
    boundary_description: str
    radius_meters: Optional[float] = None


class WarningZoneCreate(WarningZoneBase):
    pass


class WarningZone(WarningZoneBase):
    id: int
    plan_id: int
    is_active: bool
    version: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NoticeBase(BaseModel):
    notice_type: NoticeType
    recipient_name: str = Field(..., max_length=100)
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    notice_content: Optional[str] = None


class NoticeCreate(NoticeBase):
    pass


class Notice(NoticeBase):
    id: int
    plan_id: int
    sent_at: Optional[datetime] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ReceiptBase(BaseModel):
    notice_id: int
    recipient_name: str = Field(..., max_length=100)
    confirmed_at: datetime
    confirm_method: Optional[str] = None
    remark: Optional[str] = None


class ReceiptCreate(ReceiptBase):
    pass


class Receipt(ReceiptBase):
    id: int
    plan_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogBase(BaseModel):
    action: AuditAction
    operator: Optional[str] = None
    detail: Optional[str] = None


class AuditLog(AuditLogBase):
    id: int
    plan_id: int
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ExecutionReportBase(BaseModel):
    actual_blast_time: datetime
    actual_blast_volume: Optional[float] = None
    wind_direction_at_blast: Optional[str] = None
    wind_speed_at_blast: Optional[float] = None
    on_site_supervisor: Optional[str] = None
    safety_check_result: Optional[str] = None
    abnormal_situation: Optional[str] = None


class ExecutionReportCreate(ExecutionReportBase):
    pass


class ExecutionReport(ExecutionReportBase):
    id: int
    plan_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class BlastPlanBase(BaseModel):
    business_no: str = Field(..., max_length=50)
    quarry_name: str = Field(..., max_length=100)
    blast_time: datetime
    expected_blast_volume: float
    safety_measures: Optional[str] = None
    wind_direction: Optional[str] = None
    wind_speed: Optional[float] = None
    created_by: Optional[str] = None
    remark: Optional[str] = None


class BlastPlanCreate(BlastPlanBase):
    zones: List[WarningZoneCreate]
    notices: List[NoticeCreate]

    @field_validator('zones')
    def zones_not_empty(cls, v):
        if not v:
            raise ValueError('警戒区域不能为空')
        return v

    @field_validator('notices')
    def notices_not_empty(cls, v):
        if not v:
            raise ValueError('通知对象不能为空')
        return v


class BlastPlanUpdate(BaseModel):
    quarry_name: Optional[str] = None
    blast_time: Optional[datetime] = None
    expected_blast_volume: Optional[float] = None
    safety_measures: Optional[str] = None
    wind_direction: Optional[str] = None
    wind_speed: Optional[float] = None
    remark: Optional[str] = None
    zones: Optional[List[WarningZoneCreate]] = None
    notices: Optional[List[NoticeCreate]] = None


class BlastPlan(BlastPlanBase):
    id: int
    status: BlastStatus
    created_at: datetime
    updated_at: Optional[datetime] = None
    zones: List[WarningZone] = []
    notices: List[Notice] = []
    receipts: List[Receipt] = []
    audits: List[AuditLog] = []
    report: Optional[ExecutionReport] = None

    class Config:
        from_attributes = True


class BlastPlanListItem(BaseModel):
    id: int
    business_no: str
    quarry_name: str
    blast_time: datetime
    status: BlastStatus
    wind_direction: Optional[str] = None
    wind_speed: Optional[float] = None
    created_at: datetime
    receipt_count: int = 0
    notice_count: int = 0

    class Config:
        from_attributes = True


class BatchSubmitResult(BaseModel):
    success_count: int
    failed_count: int
    results: List[dict]


class ExceptionSplitResult(BaseModel):
    wind_exceptions: List[BlastPlanListItem]
    receipt_exceptions: List[BlastPlanListItem]
    zone_exceptions: List[BlastPlanListItem]
    normal_plans: List[BlastPlanListItem]


class ReviewRequest(BaseModel):
    operator: str
    review_comment: Optional[str] = None
    approve: bool


class ArchiveRequest(BaseModel):
    operator: str
    archive_remark: Optional[str] = None


class ApiResponse(BaseModel):
    code: int
    message: str
    data: Optional[dict] = None
    error_code: Optional[ErrorCode] = None
    error_details: Optional[List[str]] = None
