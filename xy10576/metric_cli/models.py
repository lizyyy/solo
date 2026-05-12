from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field


class MetricType(str, Enum):
    GAUGE = "gauge"
    COUNTER = "counter"
    RATIO = "ratio"


class ChangeStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    CHECKED = "checked"
    NEEDS_REVIEW = "needs_review"
    NEEDS_BACKFILL = "needs_backfill"
    NOTIFY_BUSINESS = "notify_business"
    INTERNAL_ONLY = "internal_only"
    COMPLETED = "completed"
    FAILED = "failed"


class BackfillStatus(str, Enum):
    NOT_NEEDED = "not_needed"
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class MetricDefinition(BaseModel):
    metric_id: str = Field(..., description="指标唯一标识")
    name: str = Field(..., description="指标名称")
    type: MetricType = Field(..., description="指标类型")
    sql: str = Field(..., description="指标计算SQL")
    aggregation: str = Field(..., description="聚合方式")
    time_window: Optional[str] = Field(default="daily", description="时间窗口")
    filters: Dict[str, Any] = Field(default_factory=dict, description="过滤条件")
    business_owner: Optional[str] = Field(default=None, description="业务负责人")
    tech_owner: Optional[str] = Field(default=None, description="技术负责人")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class Dashboard(BaseModel):
    dashboard_id: str = Field(..., description="看板ID")
    name: str = Field(..., description="看板名称")
    owner: Optional[str] = Field(default=None, description="看板负责人")
    metrics: List[str] = Field(default_factory=list, description="使用的指标ID列表")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class BackfillTask(BaseModel):
    task_id: str = Field(..., description="回填任务ID")
    metric_id: str = Field(..., description="关联指标ID")
    start_date: datetime = Field(..., description="回填开始日期")
    end_date: datetime = Field(..., description="回填结束日期")
    status: BackfillStatus = Field(default=BackfillStatus.PENDING)
    retry_count: int = Field(default=0)
    created_by: str = Field(..., description="创建人")
    created_at: datetime = Field(default_factory=datetime.now)
    completed_at: Optional[datetime] = Field(default=None)
    error_message: Optional[str] = Field(default=None)


class ChangeRecord(BaseModel):
    record_id: str = Field(..., description="变更记录ID")
    timestamp: datetime = Field(default_factory=datetime.now)
    change_type: str = Field(..., description="变更类型")
    entity_id: str = Field(..., description="实体ID")
    entity_type: str = Field(..., description="实体类型")
    before: Optional[Dict[str, Any]] = Field(default=None)
    after: Optional[Dict[str, Any]] = Field(default=None)
    operator: str = Field(..., description="操作者")
    reason: Optional[str] = Field(default=None)


class MetricChange(BaseModel):
    change_id: str = Field(..., description="变更ID")
    old_metric: Optional[MetricDefinition] = Field(default=None)
    new_metric: MetricDefinition = Field(...)
    renamed_from: Optional[str] = Field(default=None, description="如果是重命名，原指标ID")
    affected_dashboards: List[str] = Field(default_factory=list)
    backfill_tasks: List[str] = Field(default_factory=list)
    status: ChangeStatus = Field(default=ChangeStatus.PENDING)
    owner_missing: bool = Field(default=False)
    backfill_incomplete: bool = Field(default=False)
    history: List[ChangeRecord] = Field(default_factory=list)
    created_by: str = Field(..., description="创建人")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class ChangeProject(BaseModel):
    project_id: str = Field(..., description="项目ID")
    name: str = Field(..., description="项目名称")
    description: Optional[str] = Field(default=None)
    metrics: Dict[str, MetricDefinition] = Field(default_factory=dict)
    old_metrics: Dict[str, MetricDefinition] = Field(default_factory=dict)
    dashboards: Dict[str, Dashboard] = Field(default_factory=dict)
    backfill_tasks: Dict[str, BackfillTask] = Field(default_factory=dict)
    metric_changes: Dict[str, MetricChange] = Field(default_factory=dict)
    history: List[ChangeRecord] = Field(default_factory=list)
    created_by: str = Field(..., description="创建人")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class ChangeCheckResult(BaseModel):
    rule_name: str
    passed: bool
    severity: str
    message: str
    details: Dict[str, Any] = Field(default_factory=dict)


class ReportSummary(BaseModel):
    notify_business: List[Dict[str, Any]] = Field(default_factory=list)
    needs_backfill: List[Dict[str, Any]] = Field(default_factory=list)
    internal_only: List[Dict[str, Any]] = Field(default_factory=list)
    total_changes: int = 0
    issues_found: int = 0
