from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class IssueType(str, Enum):
    DYNAMIC_PARAM_CAPTURE = "dynamic_param_capture"
    DUPLICATE_PATH = "duplicate_path"
    METHOD_CONFLICT = "method_conflict"
    UNREACHABLE = "unreachable"


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class RouteCreate(BaseModel):
    path: str = Field(..., description="路由路径，如 /users/{user_id}")
    method: str = Field(default="GET", description="HTTP 方法，如 GET, POST, PUT, DELETE")
    order_index: int = Field(description="路由定义顺序，从 0 开始")


class ServiceCreate(BaseModel):
    name: str = Field(..., description="服务名称，用于唯一标识服务")
    routes: List[RouteCreate] = Field(..., description="路由清单")
    sample_requests: Optional[List[str]] = Field(None, description="样例请求 URL 列表")


class SampleRequestCreate(BaseModel):
    urls: List[str] = Field(..., description="样例请求 URL 列表")


class IssueResponse(BaseModel):
    id: int
    issue_type: str
    severity: str
    path: str
    method: Optional[str]
    affected_routes: Optional[List[Dict[str, Any]]]
    description: Optional[str]
    suggestion: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class HealthCheckResponse(BaseModel):
    id: int
    service_id: int
    status: str
    created_at: datetime
    completed_at: Optional[datetime]
    issues: List[IssueResponse]

    class Config:
        from_attributes = True


class RouteResponse(BaseModel):
    id: int
    path: str
    method: str
    order_index: int

    class Config:
        from_attributes = True


class ServiceResponse(BaseModel):
    id: int
    name: str
    created_at: datetime
    updated_at: datetime
    routes: List[RouteResponse]

    class Config:
        from_attributes = True


class MatchResult(BaseModel):
    url: str
    matched_route: Optional[str]
    matched_method: Optional[str]
    actual_match_order: int
    is_captured_by_dynamic: bool = False
    expected_route: Optional[str] = None


class HealthCheckSummary(BaseModel):
    service_name: str
    total_routes: int
    total_issues: int
    critical_issues: int
    high_issues: int
    medium_issues: int
    low_issues: int
    issues_by_type: Dict[str, int]


class FixSuggestion(BaseModel):
    priority: int
    issue_type: str
    description: str
    affected_paths: List[str]
    suggested_action: str


class ExportResponse(BaseModel):
    format: str
    content: str
