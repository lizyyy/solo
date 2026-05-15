from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import enum


class TenantStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    PENDING_REVIEW = "PENDING_REVIEW"


class ProcessingStatus(str, enum.Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    PENDING = "PENDING"
    CACHE_STALE = "CACHE_STALE"
    PARTIAL_SUCCESS = "PARTIAL_SUCCESS"


class SmsRecordCreate(BaseModel):
    phone_number: str = Field(..., description="手机号码")
    content: str = Field(..., description="短信内容")
    send_time: Optional[datetime] = None
    operator: str = Field(..., description="操作人")
    remark: Optional[str] = None


class SmsBackfillRequest(BaseModel):
    batch_no: str = Field(..., description="批次号")
    tenant_code: str = Field(..., description="租户编码")
    department: str = Field(..., description="提交部门")
    records: List[SmsRecordCreate]
    submitted_by: str = Field(..., description="提交人")


class TenantCreate(BaseModel):
    tenant_code: str
    tenant_name: str
    department: str
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None


class TenantResponse(BaseModel):
    id: int
    tenant_code: str
    tenant_name: str
    department: str
    contact_person: Optional[str]
    contact_phone: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class SmsRecordResponse(BaseModel):
    id: int
    batch_no: str
    tenant_code: str
    phone_number: str
    content: str
    send_time: Optional[datetime]
    operator: str
    department: str
    remark: Optional[str]
    is_backfill: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ProcessingLogResponse(BaseModel):
    id: int
    batch_no: str
    tenant_code: str
    action: str
    status: str
    input_summary: Optional[str]
    action_details: Optional[str]
    conclusion: Optional[str]
    error_message: Optional[str]
    logistics_screenshot_ref: Optional[str]
    executed_by: Optional[str]
    created_at: datetime
    duration_ms: Optional[int]

    class Config:
        from_attributes = True


class MaterialSummaryResponse(BaseModel):
    id: int
    batch_no: str
    tenant_code: str
    summary_content: str
    material_count: int
    export_token: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ProcessingResult(BaseModel):
    batch_no: str
    tenant_code: str
    status: str
    total_records: int
    success_count: int
    failed_count: int
    log_id: int
    summary: Optional[str]
    cache_status: str
    error_details: Optional[List[str]] = None


class QueryResponse(BaseModel):
    success: bool
    data: Optional[dict] = None
    error: Optional[str] = None


class CacheStatusResponse(BaseModel):
    cache_key: str
    is_stale: bool
    last_refresh_time: datetime
    refresh_count: int


class ExportSummaryRequest(BaseModel):
    batch_no: str
    include_logistics_sample: bool = Field(default=True, description="是否包含物流拦截样例")
