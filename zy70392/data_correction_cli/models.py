from datetime import datetime, date
from typing import Optional, List, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field, validator


class FieldType(str, Enum):
    CHANNEL = "channel"
    AMOUNT = "amount"
    USER_TAG = "user_tag"
    OTHER = "other"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class CorrectionStatus(str, Enum):
    PENDING = "pending"
    ASSESSED = "assessed"
    RISK_CONFIRMED = "risk_confirmed"
    EXECUTING = "executing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class CorrectionItem(BaseModel):
    order_id: str = Field(..., description="订单ID")
    field_name: str = Field(..., description="字段名")
    old_value: Any = Field(..., description="旧值")
    new_value: Any = Field(..., description="新值")
    field_type: FieldType = Field(..., description="字段类型")
    reason: Optional[str] = Field(None, description="订正原因")


class CorrectionPlan(BaseModel):
    plan_id: str = Field(..., description="订正计划ID")
    plan_name: str = Field(..., description="订正计划名称")
    created_at: datetime = Field(default_factory=datetime.now)
    created_by: str = Field(..., description="创建人")
    items: List[CorrectionItem] = Field(default_factory=list, description="订正项列表")
    description: Optional[str] = Field(None, description="订正描述")

    @validator('items')
    def check_items_not_empty(cls, v):
        if not v:
            raise ValueError("订正范围不能为空")
        return v

    @validator('items')
    def check_no_duplicate_orders(cls, v):
        seen = set()
        duplicates = []
        for item in v:
            key = (item.order_id, item.field_name)
            if key in seen:
                duplicates.append(key)
            seen.add(key)
        if duplicates:
            raise ValueError(f"存在重复订正项: {duplicates}")
        return v


class DownstreamDependency(BaseModel):
    dependency_id: str = Field(..., description="依赖ID")
    name: str = Field(..., description="下游系统名称")
    type: str = Field(..., description="类型: report/bill/tag/cache/other")
    owner: Optional[str] = Field(None, description="负责人")
    affected_fields: List[str] = Field(default_factory=list, description="受影响的字段")
    refresh_method: str = Field(..., description="刷新方式: recalc/refresh_cache/none")
    priority: int = Field(1, description="执行优先级")
    depends_on: List[str] = Field(default_factory=list, description="依赖的其他系统")


class ReportRule(BaseModel):
    rule_id: str = Field(..., description="规则ID")
    report_name: str = Field(..., description="报表名称")
    affected_fields: List[str] = Field(default_factory=list, description="受影响的字段")
    period: str = Field(..., description="报表周期: daily/weekly/monthly/quarterly")
    affected_periods: List[date] = Field(default_factory=list, description="受影响的期数")
    owner: Optional[str] = Field(None, description="负责人")
    requires_recalc: bool = Field(True, description="是否需要重算")


class BillRule(BaseModel):
    rule_id: str = Field(..., description="规则ID")
    bill_name: str = Field(..., description="账单名称")
    affected_fields: List[str] = Field(default_factory=list, description="受影响的字段")
    affected_periods: List[date] = Field(default_factory=list, description="受影响的期数")
    is_settled: bool = Field(False, description="是否已结算")
    settled_at: Optional[datetime] = Field(None, description="结算时间")
    owner: Optional[str] = Field(None, description="负责人")
    affects_amount: bool = Field(False, description="是否影响金额")


class CacheConfig(BaseModel):
    cache_id: str = Field(..., description="缓存ID")
    cache_name: str = Field(..., description="缓存名称")
    affected_fields: List[str] = Field(default_factory=list, description="受影响的字段")
    ttl_seconds: int = Field(3600, description="过期时间(秒)")
    cache_keys: List[str] = Field(default_factory=list, description="需要刷新的缓存键")
    owner: Optional[str] = Field(None, description="负责人")


class AssessmentResultItem(BaseModel):
    target_id: str = Field(..., description="目标ID")
    target_name: str = Field(..., description="目标名称")
    target_type: str = Field(..., description="类型: report/bill/tag/cache")
    action: str = Field(..., description="操作: recalc/refresh_cache/skip")
    risk_level: RiskLevel = Field(..., description="风险等级")
    owner: Optional[str] = Field(None, description="负责人")
    reason: str = Field(..., description="原因")
    requires_approval: bool = Field(False, description="是否需要审批")
    is_settled: bool = Field(False, description="是否已结算")


class AssessmentResult(BaseModel):
    plan_id: str = Field(..., description="订正计划ID")
    assessed_at: datetime = Field(default_factory=datetime.now)
    items: List[AssessmentResultItem] = Field(default_factory=list)
    needs_approval: bool = Field(False, description="是否需要审批")
    has_settled_bills: bool = Field(False, description="是否包含已结算账单")
    missing_owners: List[str] = Field(default_factory=list, description="缺少负责人的下游")
    issues: List[str] = Field(default_factory=list, description="问题列表")


class RiskConfirmation(BaseModel):
    plan_id: str = Field(..., description="订正计划ID")
    confirmed_at: datetime = Field(default_factory=datetime.now)
    confirmed_by: str = Field(..., description="确认人")
    approval_level: str = Field(..., description="审批级别: normal/senior/executive")
    comments: Optional[str] = Field(None, description="备注")


class ExecutionPlan(BaseModel):
    plan_id: str = Field(..., description="订正计划ID")
    generated_at: datetime = Field(default_factory=datetime.now)
    steps: List[Dict[str, Any]] = Field(default_factory=list)
    rollback_plan: List[Dict[str, Any]] = Field(default_factory=list)


class BusinessSignatureReport(BaseModel):
    plan_id: str = Field(..., description="订正计划ID")
    plan_name: str = Field(..., description="订正计划名称")
    created_by: str = Field(..., description="创建人")
    generated_at: datetime = Field(default_factory=datetime.now)
    affected_objects: List[Dict[str, Any]] = Field(default_factory=list)
    recalc_steps: List[Dict[str, Any]] = Field(default_factory=list)
    risk_level: RiskLevel = Field(..., description="整体风险等级")
    rollback_suggestions: List[str] = Field(default_factory=list)
    settled_items: List[Dict[str, Any]] = Field(default_factory=list)
    cannot_auto_process: List[Dict[str, Any]] = Field(default_factory=list)
    suggested_order: List[str] = Field(default_factory=list)
    signature_fields: Dict[str, Any] = Field(default_factory=dict)
