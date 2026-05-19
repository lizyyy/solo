from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Dict, Any, List

from app.database import FixtureStatus, FixtureExceptionType


class FixtureCreate(BaseModel):
    request_method: str = Field(..., description="HTTP 请求方法")
    request_url: str = Field(..., description="请求 URL")
    request_headers: Dict[str, Any] = Field(..., description="完整请求头")
    signature_headers: Dict[str, Any] = Field(..., description="签名相关头")
    raw_payload: str = Field(..., description="原始载荷体")
    timestamp: Optional[datetime] = Field(default_factory=datetime.utcnow, description="时间戳")
    handler: Optional[str] = Field(None, description="处理人")


class FixtureUpdate(BaseModel):
    normalized_payload: Optional[str] = Field(None, description="规范化载荷")
    handler: Optional[str] = Field(None, description="处理人")
    status: Optional[FixtureStatus] = Field(None, description="状态")


class FixtureManualFix(BaseModel):
    signature_headers: Optional[Dict[str, Any]] = Field(None, description="修正后的签名头")
    raw_payload: Optional[str] = Field(None, description="修正后的载荷")
    normalized_payload: Optional[str] = Field(None, description="修正后的规范化载荷")
    handler: str = Field(..., description="处理人")
    conclusion: str = Field(..., description="处理结论")


class FixtureResponse(BaseModel):
    id: int
    fixture_id: str
    request_method: str
    request_url: str
    request_headers: Dict[str, Any]
    signature_headers: Dict[str, Any]
    raw_payload: str
    normalized_payload: Optional[str]
    timestamp: datetime
    status: FixtureStatus
    fixture_directory: Optional[str]
    handler: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ExceptionCreate(BaseModel):
    exception_type: FixtureExceptionType
    raw_input: str
    handler: str
    conclusion: Optional[str] = None


class ExceptionResponse(BaseModel):
    id: int
    fixture_id: int
    exception_type: FixtureExceptionType
    raw_input: str
    handler: str
    conclusion: Optional[str]
    resolved: bool
    created_at: datetime
    resolved_at: Optional[datetime]

    class Config:
        from_attributes = True


class FixtureDetailResponse(FixtureResponse):
    exceptions: List[ExceptionResponse] = []


class ReportResponse(BaseModel):
    id: int
    fixture_id: int
    report_content: str
    replay_script_path: Optional[str]
    exported_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class ReplayScriptGenerate(BaseModel):
    target_url: Optional[str] = Field(None, description="目标重放 URL")


class StatusUpdate(BaseModel):
    status: FixtureStatus
    handler: Optional[str] = Field(None, description="处理人")
