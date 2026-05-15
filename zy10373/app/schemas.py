from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models import ExportStatus


class ExpiryPolicy(BaseModel):
    type: str = Field(description="过期策略类型: hours, downloads, never")
    value: Optional[int] = Field(None, description="策略值，如小时数或下载次数")


class FieldScope(BaseModel):
    table_name: str
    fields: List[str]


class ExportRequestCreate(BaseModel):
    request_id: str = Field(description="幂等请求ID")
    requester_id: str
    requester_name: str
    data_source: str
    field_scope: List[FieldScope]
    expiry_policy: ExpiryPolicy
    idempotency_key: str = Field(description="幂等性键值")


class ExportRequestResponse(BaseModel):
    id: int
    request_id: str
    requester_id: str
    requester_name: str
    data_source: str
    field_scope: List[Dict[str, Any]]
    status: ExportStatus
    watermark_id: Optional[str]
    expiry_time: Optional[datetime]
    current_handler: Optional[str]
    final_conclusion: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class WatermarkGenerateRequest(BaseModel):
    request_id: str
    watermark_type: str = Field(description="水印类型: text, image, qrcode")
    watermark_content: Dict[str, Any]


class WatermarkResponse(BaseModel):
    watermark_id: str
    watermark_type: str
    content: Dict[str, Any]
    generated_by: str
    generated_at: datetime

    class Config:
        from_attributes = True


class FieldAuthorizationRequest(BaseModel):
    requester_id: str
    data_source: str
    field_name: str


class FieldAuthorizationResponse(BaseModel):
    requester_id: str
    data_source: str
    field_name: str
    is_authorized: bool
    authorized_by: Optional[str]
    authorized_at: Optional[datetime]

    class Config:
        from_attributes = True


class StatusUpdateRequest(BaseModel):
    request_id: str
    new_status: ExportStatus
    operator_id: str
    operator_name: str
    remark: Optional[str] = None


class DownloadSignatureRequest(BaseModel):
    request_id: str
    downloader_id: str
    downloader_name: str


class DownloadSignatureResponse(BaseModel):
    request_id: str
    signature: str
    expires_at: datetime
    download_url: str


class AuditLogResponse(BaseModel):
    id: int
    action: str
    old_status: Optional[str]
    new_status: Optional[str]
    operator_id: str
    operator_name: str
    remark: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ExportHistoryQuery(BaseModel):
    requester_id: Optional[str] = None
    status: Optional[ExportStatus] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    page: int = 1
    page_size: int = 20


class ErrorResponse(BaseModel):
    error_code: str
    error_message: str
    request_id: Optional[str] = None
    timestamp: datetime
    details: Optional[Dict[str, Any]] = None


class SuccessResponse(BaseModel):
    code: str = "SUCCESS"
    message: str
    data: Optional[Any] = None
    timestamp: datetime
