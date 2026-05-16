from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum

class IncidentStatus(str, Enum):
    DETECTED = "detected"
    ANALYZING = "analyzing"
    CONFIRMED = "confirmed"
    RESOLVED = "resolved"
    CLOSED = "closed"

class ClueSource(str, Enum):
    MONITORING = "monitoring"
    LOG = "log"
    MANUAL = "manual"
    CORRELATION = "correlation"

class TenantBase(BaseModel):
    tenant_id: str = Field(..., description="租户唯一标识")
    name: str = Field(..., description="租户名称")
    email: Optional[str] = Field(None, description="联系邮箱")

class TenantCreate(TenantBase):
    pass

class Tenant(TenantBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class UsageMetricBase(BaseModel):
    metric_name: str = Field(..., description="指标名称")
    metric_value: float = Field(..., description="指标值")
    unit: str = Field(..., description="单位")
    timestamp: datetime = Field(..., description="时间戳")
    baseline_value: Optional[float] = Field(None, description="基线值")
    deviation_percent: Optional[float] = Field(None, description="偏差百分比")
    raw_data: Optional[str] = Field(None, description="原始数据")

class UsageMetricCreate(UsageMetricBase):
    tenant_id: str

class UsageMetric(UsageMetricBase):
    id: int
    
    class Config:
        from_attributes = True

class AnomalyWindowBase(BaseModel):
    window_start: datetime = Field(..., description="窗口开始时间")
    window_end: datetime = Field(..., description="窗口结束时间")
    peak_value: float = Field(..., description="峰值")
    baseline_value: float = Field(..., description="基线值")
    deviation_percent: float = Field(..., description="偏差百分比")
    severity: str = Field(..., description="严重程度")

class AnomalyWindowCreate(AnomalyWindowBase):
    incident_id: int
    usage_metric_id: int

class AnomalyWindow(AnomalyWindowBase):
    id: int
    incident_id: int
    usage_metric_id: int
    
    class Config:
        from_attributes = True

class AttributionClueBase(BaseModel):
    clue_key: str = Field(..., description="线索唯一键（用于幂等）")
    source: ClueSource = Field(..., description="线索来源")
    title: str = Field(..., description="线索标题")
    description: Optional[str] = Field(None, description="线索描述")
    confidence: float = Field(0.0, description="置信度")
    raw_data: Optional[Dict[str, Any]] = Field(None, description="原始数据")
    is_manual: bool = Field(False, description="是否人工添加")

class AttributionClueCreate(AttributionClueBase):
    incident_id: Optional[int] = None

class AttributionClue(AttributionClueBase):
    id: int
    incident_id: int
    timestamp: datetime
    
    class Config:
        from_attributes = True

class ActionItemBase(BaseModel):
    action_type: str = Field(..., description="动作类型")
    description: str = Field(..., description="动作描述")
    owner: Optional[str] = Field(None, description="负责人")
    status: str = Field("pending", description="状态")

class ActionItemCreate(ActionItemBase):
    incident_id: Optional[int] = None
    clue_id: Optional[int] = None

class ActionItem(ActionItemBase):
    id: int
    incident_id: int
    clue_id: Optional[int]
    created_at: datetime
    completed_at: Optional[datetime]
    result: Optional[str]
    
    class Config:
        from_attributes = True

class IncidentSummaryBase(BaseModel):
    root_cause: Optional[str] = Field(None, description="根本原因")
    impact_assessment: Optional[str] = Field(None, description="影响评估")
    resolution_summary: Optional[str] = Field(None, description="解决总结")
    lessons_learned: Optional[str] = Field(None, description="经验教训")

class IncidentSummaryUpdate(IncidentSummaryBase):
    pass

class IncidentSummary(IncidentSummaryBase):
    id: int
    incident_id: int
    exported_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class IncidentBase(BaseModel):
    title: Optional[str] = Field(None, description="事故标题")
    description: Optional[str] = Field(None, description="事故描述")
    severity: Optional[str] = Field("medium", description="严重程度")

class IncidentCreate(IncidentBase):
    tenant: TenantCreate = Field(..., description="租户信息")
    metric_name: str = Field(..., description="异常指标名称")
    unit: Optional[str] = Field("requests", description="单位")
    window_start: datetime = Field(..., description="异常窗口开始时间")
    window_end: datetime = Field(..., description="异常窗口结束时间")
    threshold_percent: float = Field(50.0, description="异常阈值百分比")
    attribution_clues: Optional[List[Dict[str, Any]]] = Field(None, description="归因线索列表")

class IncidentUpdate(IncidentBase):
    status: Optional[IncidentStatus] = Field(None, description="状态")

class Incident(IncidentBase):
    id: int
    tenant_id: int
    incident_key: str
    status: IncidentStatus
    detected_at: datetime
    confirmed_at: Optional[datetime]
    resolved_at: Optional[datetime]
    closed_at: Optional[datetime]
    original_input: Optional[str]
    processing_result: Optional[str]
    created_at: datetime
    updated_at: datetime
    tenant: Tenant
    anomaly_windows: List[AnomalyWindow] = []
    attribution_clues: List[AttributionClue] = []
    action_items: List[ActionItem] = []
    summary: Optional[IncidentSummary] = None
    
    class Config:
        from_attributes = True

class ManualCorrection(BaseModel):
    severity: Optional[str] = Field(None, description="调整严重程度")
    title: Optional[str] = Field(None, description="调整标题")
    description: Optional[str] = Field(None, description="调整描述")
    baseline_adjustment: Optional[float] = Field(None, description="基线调整百分比")
    processing_result: Optional[Dict[str, Any]] = Field(None, description="处理结果调整")
    comment: Optional[str] = Field(None, description="调整备注")
    reclaculate: bool = Field(False, description="是否重新计算")

class StatusUpdate(BaseModel):
    status: IncidentStatus = Field(..., description="新状态")
    comment: Optional[str] = Field(None, description="状态变更备注")

class IncidentListResponse(BaseModel):
    total: int
    items: List[Incident]
    skip: int
    limit: int

class ExportResponse(BaseModel):
    success: bool
    data: Dict[str, Any]
    exported_at: datetime
