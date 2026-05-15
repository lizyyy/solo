from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.models import SampleStatus, ErrorCategory


class SampleCreate(BaseModel):
    http_method: str = Field(..., description="HTTP请求方法")
    api_endpoint: str = Field(..., description="API端点")
    request_payload: str = Field(..., description="原始请求载荷")
    response_payload: str = Field(..., description="原始响应载荷")
    error_code: Optional[str] = Field(None, description="错误码")
    error_message: Optional[str] = Field(None, description="错误信息")
    created_by: str = Field(..., description="创建人")
    retention_days: int = Field(30, description="保留天数")


class SampleValidate(BaseModel):
    validated_by: str = Field(..., description="校验人")
    validation_notes: Optional[str] = Field(None, description="校验备注")


class SampleClassify(BaseModel):
    error_category: ErrorCategory = Field(..., description="错误分类")
    classified_by: str = Field(..., description="分类人")


class SampleReproduce(BaseModel):
    reproduce_steps: str = Field(..., description="复现步骤")
    reproduce_success: bool = Field(..., description="是否复现成功")
    reproduced_by: str = Field(..., description="复现操作人")


class SampleFix(BaseModel):
    fix_issue_id: str = Field(..., description="修复Issue ID")
    fix_description: str = Field(..., description="修复描述")
    fixed_by: str = Field(..., description="修复人")


class SampleHistoryResponse(BaseModel):
    id: int
    status: SampleStatus
    description: str
    operated_by: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class SampleResponse(BaseModel):
    id: int
    sample_hash: str
    status: SampleStatus
    error_category: Optional[ErrorCategory]
    error_code: Optional[str]
    error_message: Optional[str]
    http_method: str
    api_endpoint: str
    sanitized_payload: Optional[str]
    reproduce_steps: Optional[str]
    reproduce_success: bool
    fix_issue_id: Optional[str]
    fix_description: Optional[str]
    fixed_at: Optional[datetime]
    retention_days: int
    expires_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str]
    handled_by: Optional[str]
    history_records: List[SampleHistoryResponse]

    class Config:
        from_attributes = True


class SampleListResponse(BaseModel):
    total: int
    items: List[SampleResponse]


class ErrorResponse(BaseModel):
    error_code: str
    error_message: str
    details: Optional[dict] = None
