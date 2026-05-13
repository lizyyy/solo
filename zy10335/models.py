from enum import Enum
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


class DesensitizationLevel(str, Enum):
    NONE = "none"
    MASK = "mask"
    HASH = "hash"
    ENCRYPT = "encrypt"
    REMOVE = "remove"


class RuleStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    DEPRECATED = "deprecated"


class FieldPath(BaseModel):
    path: str = Field(..., description="JSON路径表达式，如 user.contact.phone")
    level: DesensitizationLevel = Field(..., description="脱敏级别")
    pattern: Optional[str] = Field(None, description="匹配正则模式")


class ProxyRule(BaseModel):
    rule_id: str = Field(..., description="规则唯一标识")
    name: str = Field(..., description="规则名称")
    description: Optional[str] = Field(None, description="规则描述")
    api_path: str = Field(..., description="API路径匹配模式")
    method: str = Field("POST", description="HTTP方法")
    fields: List[FieldPath] = Field(default_factory=list, description="字段脱敏配置")
    allowed_callers: List[str] = Field(default_factory=list, description="允许的调用方列表")
    status: RuleStatus = Field(RuleStatus.DRAFT, description="规则状态")
    created_by: str = Field(..., description="创建人")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None


class AccessRecord(BaseModel):
    record_id: str = Field(..., description="记录唯一标识")
    rule_id: str = Field(..., description="关联规则ID")
    caller: str = Field(..., description="调用方标识")
    request_id: str = Field(..., description="请求ID，用于去重")
    api_path: str = Field(..., description="实际请求路径")
    original_digest: str = Field(..., description="原始数据摘要")
    desensitized_digest: str = Field(..., description="脱敏后数据摘要")
    matched_fields: List[str] = Field(default_factory=list, description="匹配到的字段")
    status: str = Field("success", description="处理状态")
    error_message: Optional[str] = None
    accessed_at: datetime = Field(default_factory=datetime.now)
    processed_by: Optional[str] = None
    processed_at: Optional[datetime] = None


class RuleCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    api_path: str = Field(..., description="API路径，支持通配符")
    method: str = "POST"
    fields: List[FieldPath]
    allowed_callers: List[str] = Field(default_factory=list)


class ValidationRequest(BaseModel):
    rule_id: str
    caller: str
    request_id: str
    api_path: str
    data: Dict[str, Any]


class ValidationResponse(BaseModel):
    success: bool
    rule_id: str
    request_id: str
    original_digest: str
    desensitized_digest: str
    desensitized_data: Dict[str, Any]
    matched_fields: List[str]
    message: str = ""


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[Dict[str, Any]] = None
    request_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)
