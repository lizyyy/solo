from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class IncidentStatus(str, Enum):
    CREATED = "created"
    INVESTIGATING = "investigating"
    ATTRIBUTED = "attributed"
    RESOLVED = "resolved"
    CLOSED = "closed"
    WITHDRAWN = "withdrawn"


class ClueType(str, Enum):
    LOG_ANOMALY = "log_anomaly"
    MONITOR_ALERT = "monitor_alert"
    USER_REPORT = "user_report"
    BILLING_ABNORMAL = "billing_abnormal"
    API_TRAFFIC = "api_traffic"
    RESOURCE_USAGE = "resource_usage"


class ActionType(str, Enum):
    STATUS_CHANGE = "status_change"
    ADD_CLUE = "add_clue"
    MANUAL_CORRECT = "manual_correct"
    ADD_NOTE = "add_note"


class AttributionClueBase(BaseModel):
    source_system: str = Field(..., description="线索来源系统")
    clue_type: str = Field(..., description="线索类型")
    description: str = Field(..., description="线索描述")
    confidence: float = Field(0.0, ge=0, le=1, description="置信度")
    is_primary: bool = Field(False, description="是否主要线索")


class AttributionClueCreate(AttributionClueBase):
    created_by: str = Field(..., description="创建人")


class AttributionClue(AttributionClueBase):
    id: str
    incident_id: str
    created_at: datetime
    created_by: str

    class Config:
        from_attributes = True


class ProcessActionBase(BaseModel):
    action_type: str = Field(..., description="动作类型")
    operator: str = Field(..., description="操作人")
    conclusion: Optional[str] = Field(None, description="处理结论")
    from_status: Optional[str] = Field(None, description="源状态")
    to_status: Optional[str] = Field(None, description="目标状态")


class ProcessActionCreate(ProcessActionBase):
    pass


class ProcessAction(ProcessActionBase):
    id: str
    incident_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class IncidentBase(BaseModel):
    tenant_id: str = Field(..., description="租户ID")
    tenant_name: str = Field(..., description="租户名称")
    metric_name: str = Field(..., description="用量指标名称")
    metric_value: float = Field(..., description="指标值")
    baseline_value: float = Field(..., description="基线值")
    deviation_ratio: float = Field(..., description="偏离比例")
    start_time: datetime = Field(..., description="异常开始时间")
    end_time: datetime = Field(..., description="异常结束时间")
    title: str = Field(..., description="事故标题")
    created_by: str = Field(..., description="创建人")
    raw_input: Optional[str] = Field(None, description="原始输入")


class IncidentCreate(IncidentBase):
    id: Optional[str] = Field(None, description="可选，用于幂等")


class IncidentUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    metric_value: Optional[float] = None
    baseline_value: Optional[float] = None
    deviation_ratio: Optional[float] = None


class Incident(IncidentBase):
    id: str
    status: IncidentStatus
    summary: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    clues: List[AttributionClue] = []
    actions: List[ProcessAction] = []

    class Config:
        from_attributes = True


class StatusTransition(BaseModel):
    target_status: IncidentStatus = Field(..., description="目标状态")
    operator: str = Field(..., description="操作人")
    conclusion: Optional[str] = Field(None, description="状态变更说明")


class IncidentQuery(BaseModel):
    tenant_id: Optional[str] = None
    status: Optional[IncidentStatus] = None
    start_time_from: Optional[datetime] = None
    start_time_to: Optional[datetime] = None
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


class IncidentExport(BaseModel):
    incident_id: str
    title: str
    tenant_id: str
    tenant_name: str
    metric_name: str
    metric_value: float
    baseline_value: float
    deviation_ratio: float
    start_time: datetime
    end_time: datetime
    status: str
    summary: Optional[str]
    clue_count: int
    primary_clue: Optional[str]
    final_conclusion: Optional[str]
    created_at: datetime
    closed_at: Optional[datetime]


class ConflictResponse(BaseModel):
    conflict: bool = True
    existing_incident_id: str
    message: str
