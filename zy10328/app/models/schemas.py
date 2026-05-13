from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class StatusEnum(str, Enum):
    CREATED = "CREATED"
    VALIDATING = "VALIDATING"
    PROCESSING = "PROCESSING"
    AGGREGATING = "AGGREGATING"
    COMPLETED = "COMPLETED"
    REVOKED = "REVOKED"
    FAILED = "FAILED"


class RiskLevelEnum(str, Enum):
    UNKNOWN = "UNKNOWN"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class DownstreamServiceCreate(BaseModel):
    service_name: str = Field(..., description="下游服务名称")
    service_type: Optional[str] = Field(None, description="服务类型")
    endpoint: Optional[str] = Field(None, description="服务端点")
    method: Optional[str] = Field(None, description="调用方法")
    cache_key: Optional[str] = Field(None, description="缓存键")
    cache_ttl: Optional[int] = Field(None, description="缓存TTL(秒)")


class CallSampleCreate(BaseModel):
    trace_id: str = Field(..., description="链路追踪ID")
    request_id: Optional[str] = Field(None, description="请求ID")
    user_id: Optional[str] = Field(None, description="用户ID")
    timestamp: datetime = Field(..., description="调用时间")
    status: str = Field(..., description="调用状态")
    total_latency: float = Field(..., description="总耗时(ms)")
    category: Optional[str] = Field(None, description="样本分类")
    request_data: Optional[Dict[str, Any]] = Field(None, description="请求数据")
    response_data: Optional[Dict[str, Any]] = Field(None, description="响应数据")
    error_message: Optional[str] = Field(None, description="错误信息")
    error_stack: Optional[str] = Field(None, description="错误栈")
    downstream_calls: Optional[List[Dict[str, Any]]] = Field(None, description="下游调用详情")


class EntryAPICreate(BaseModel):
    id: Optional[str] = Field(None, description="API唯一标识(自动生成)")
    name: str = Field(..., description="入口接口名称")
    method: str = Field(..., description="HTTP方法")
    path: str = Field(..., description="接口路径")
    description: Optional[str] = Field(None, description="接口描述")
    downstream_services: Optional[List[DownstreamServiceCreate]] = Field(None, description="下游服务列表")
    call_samples: Optional[List[CallSampleCreate]] = Field(None, description="调用样本列表")


class EntryAPIUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    risk_level: Optional[RiskLevelEnum] = None
    risk_description: Optional[str] = None


class StatusUpdate(BaseModel):
    status: StatusEnum = Field(..., description="目标状态")
    reason: Optional[str] = Field(None, description="状态变更原因")
    operator: Optional[str] = Field("system", description="操作人")


class DownstreamServiceResponse(BaseModel):
    id: str
    service_name: str
    service_type: Optional[str]
    endpoint: Optional[str]
    method: Optional[str]
    cache_key: Optional[str]
    cache_ttl: Optional[int]
    call_count: int
    success_count: int
    failure_count: int
    avg_latency: float
    p50_latency: float
    p95_latency: float
    p99_latency: float
    risk_level: str
    risk_description: Optional[str]

    class Config:
        from_attributes = True


class CallSampleResponse(BaseModel):
    id: str
    trace_id: str
    request_id: Optional[str]
    user_id: Optional[str]
    timestamp: datetime
    status: str
    total_latency: float
    category: Optional[str]
    error_message: Optional[str]

    class Config:
        from_attributes = True


class LatencyDistributionResponse(BaseModel):
    bucket: str
    min_ms: float
    max_ms: float
    count: int
    percentage: float

    class Config:
        from_attributes = True


class HistoryRecordResponse(BaseModel):
    id: str
    action: str
    operator: str
    previous_status: Optional[str]
    new_status: Optional[str]
    change_reason: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class EntryAPIResponse(BaseModel):
    id: str
    name: str
    method: str
    path: str
    description: Optional[str]
    status: str
    risk_level: str
    risk_description: Optional[str]
    created_at: datetime
    updated_at: datetime
    downstream_services: List[DownstreamServiceResponse] = []
    call_samples: List[CallSampleResponse] = []
    history_records: List[HistoryRecordResponse] = []

    class Config:
        from_attributes = True


class ProfileSummary(BaseModel):
    entry_api_id: str
    total_samples: int
    success_samples: int
    failed_samples: int
    avg_total_latency: float
    downstream_count: int
    overall_risk_level: str
    status: str


class ExportRequest(BaseModel):
    format: str = Field("json", description="导出格式: json, excel")
    include_samples: bool = Field(True, description="是否包含样本数据")
    include_history: bool = Field(True, description="是否包含历史记录")


class ErrorResponse(BaseModel):
    error_code: str
    error_message: str
    details: Optional[Dict[str, Any]] = None
    suggestion: Optional[str] = None
