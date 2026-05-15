from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models import VerificationStatus, DiffLevel


class GrayVersionBase(BaseModel):
    version: str = Field(..., description="灰度版本号")
    description: Optional[str] = Field(None, description="版本描述")
    target_url: str = Field(..., description="灰度环境地址")
    base_url: str = Field(..., description="基准环境地址")
    created_by: str = Field(..., description="创建人")


class GrayVersionCreate(GrayVersionBase):
    pass


class GrayVersionUpdate(BaseModel):
    description: Optional[str] = None
    target_url: Optional[str] = None
    base_url: Optional[str] = None
    status: Optional[VerificationStatus] = None


class GrayVersion(GrayVersionBase):
    id: int
    status: VerificationStatus
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class HistoryRequestBase(BaseModel):
    request_id: str = Field(..., description="请求唯一标识")
    method: str = Field(..., description="HTTP方法")
    path: str = Field(..., description="请求路径")
    headers: Optional[Dict[str, Any]] = Field(None, description="请求头")
    query_params: Optional[Dict[str, Any]] = Field(None, description="查询参数")
    request_body: Optional[Dict[str, Any]] = Field(None, description="请求体")
    base_response: Optional[Dict[str, Any]] = Field(None, description="基准环境响应")
    base_status_code: Optional[int] = Field(None, description="基准环境状态码")
    base_response_time: Optional[float] = Field(None, description="基准环境响应时间(ms)")


class HistoryRequestCreate(HistoryRequestBase):
    pass


class HistoryRequest(HistoryRequestBase):
    id: int
    gray_version_id: int
    gray_response: Optional[Dict[str, Any]]
    gray_status_code: Optional[int]
    gray_response_time: Optional[float]
    replayed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class ResponseDiffBase(BaseModel):
    diff_path: str = Field(..., description="差异路径")
    diff_type: str = Field(..., description="差异类型")
    base_value: Optional[str] = Field(None, description="基准值")
    gray_value: Optional[str] = Field(None, description="灰度值")
    level: DiffLevel = Field(DiffLevel.WARNING, description="差异级别")


class ResponseDiffCreate(ResponseDiffBase):
    request_id: int


class ResponseDiff(ResponseDiffBase):
    id: int
    request_id: int
    is_tolerated: bool
    tolerance_rule_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class ToleranceRuleBase(BaseModel):
    name: str = Field(..., description="规则名称")
    description: Optional[str] = Field(None, description="规则描述")
    path_pattern: str = Field(..., description="路径匹配模式")
    diff_type: Optional[str] = Field(None, description="差异类型")
    tolerance_type: str = Field(..., description="容忍类型")
    tolerance_value: Optional[Dict[str, Any]] = Field(None, description="容忍值配置")
    is_active: bool = Field(True, description="是否启用")
    created_by: Optional[str] = Field(None, description="创建人")


class ToleranceRuleCreate(ToleranceRuleBase):
    pass


class ToleranceRule(ToleranceRuleBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ConfirmerBase(BaseModel):
    user_id: str = Field(..., description="用户ID")
    user_name: str = Field(..., description="用户姓名")
    role: Optional[str] = Field(None, description="角色")


class ConfirmerCreate(ConfirmerBase):
    gray_version_id: int


class ConfirmerConfirm(BaseModel):
    user_id: str = Field(..., description="确认人用户ID")
    confirmed: bool
    comment: Optional[str] = None


class Confirmer(ConfirmerBase):
    id: int
    gray_version_id: int
    confirmed: bool
    confirmed_at: Optional[datetime]
    comment: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ReleaseConclusionBase(BaseModel):
    conclusion_type: str = Field(..., description="结论类型")
    summary: str = Field(..., description="总结")
    total_requests: int = Field(0, description="总请求数")
    success_requests: int = Field(0, description="成功请求数")
    failed_requests: int = Field(0, description="失败请求数")
    total_diffs: int = Field(0, description="总差异数")
    critical_diffs: int = Field(0, description="严重差异数")
    error_diffs: int = Field(0, description="错误差异数")
    warning_diffs: int = Field(0, description="警告差异数")
    tolerated_diffs: int = Field(0, description="已容忍差异数")


class ReleaseConclusionCreate(ReleaseConclusionBase):
    gray_version_id: int
    released_by: str


class ReleaseConclusion(ReleaseConclusionBase):
    id: int
    gray_version_id: int
    released_by: Optional[str]
    released_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class TimelineBase(BaseModel):
    action: str = Field(..., description="动作")
    actor: Optional[str] = Field(None, description="操作者")
    details: Optional[Dict[str, Any]] = Field(None, description="详情")


class TimelineCreate(TimelineBase):
    gray_version_id: Optional[int] = None
    request_id: Optional[int] = None


class Timeline(TimelineBase):
    id: int
    gray_version_id: Optional[int]
    request_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class VerificationJobCreate(BaseModel):
    version: str
    description: Optional[str] = None
    target_url: str
    base_url: str
    created_by: str
    requests: List[HistoryRequestCreate]
    confirmers: List[ConfirmerBase]


class VerificationResult(BaseModel):
    gray_version: GrayVersion
    total_requests: int
    replayed_requests: int
    total_diffs: int
    critical_diffs: int
    error_diffs: int
    warning_diffs: int
    tolerated_diffs: int
    status: VerificationStatus


class ExportRequest(BaseModel):
    version: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    include_diffs: bool = True
    include_timeline: bool = True
