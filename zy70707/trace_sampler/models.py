from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field, validator


class SamplingMode(str, Enum):
    RATE_BASED = "rate_based"
    BUDGET_BASED = "budget_based"
    TAG_PRIORITY = "tag_priority"


class AdjustmentStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class TagMatchType(str, Enum):
    EXACT = "exact"
    PREFIX = "prefix"
    REGEX = "regex"
    EXISTS = "exists"


class Service(BaseModel):
    name: str
    environment: str = "production"
    department: str
    created_at: datetime = Field(default_factory=datetime.now)

    class Config:
        frozen = True


class SamplingBudget(BaseModel):
    service_name: str
    daily_budget: int = Field(gt=0)
    used_budget: int = Field(ge=0, default=0)
    reserved_budget: int = Field(ge=0, default=0)
    date: str
    last_updated: datetime = Field(default_factory=datetime.now)

    @property
    def remaining_budget(self) -> int:
        return max(0, self.daily_budget - self.used_budget - self.reserved_budget)

    @property
    def utilization_rate(self) -> float:
        if self.daily_budget == 0:
            return 1.0
        return (self.used_budget + self.reserved_budget) / self.daily_budget

    def has_sufficient_budget(self, requested: int = 1) -> bool:
        return self.remaining_budget >= requested


class TagRule(BaseModel):
    rule_id: str
    service_name: str
    tag_key: str
    tag_value: Optional[str] = None
    match_type: TagMatchType = TagMatchType.EXACT
    priority: int = Field(ge=0, le=100, default=50)
    sampling_rate: float = Field(ge=0.0, le=1.0, default=1.0)
    budget_reservation: int = Field(ge=0, default=0)
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.now)
    created_by: str

    def matches(self, tags: Dict[str, str]) -> bool:
        if not self.is_active:
            return False

        tag_value = tags.get(self.tag_key)

        if self.match_type == TagMatchType.EXISTS:
            return tag_value is not None

        if tag_value is None:
            return False

        if self.match_type == TagMatchType.EXACT:
            return tag_value == self.tag_value
        elif self.match_type == TagMatchType.PREFIX:
            return tag_value.startswith(self.tag_value or "")
        elif self.match_type == TagMatchType.REGEX:
            import re
            try:
                return bool(re.match(self.tag_value or "", tag_value))
            except:
                return False

        return False


class AdjustmentRequest(BaseModel):
    request_id: str
    service_name: str
    requester: str
    reason: str
    adjustment_type: str
    old_value: Any
    new_value: Any
    status: AdjustmentStatus = AdjustmentStatus.PENDING
    approver: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.now)
    effective_from: Optional[datetime] = None
    effective_to: Optional[datetime] = None
    idempotency_key: str

    @validator("idempotency_key")
    def validate_idempotency_key(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError("idempotency_key cannot be empty")
        return v.strip()

    def is_effective(self, at_time: Optional[datetime] = None) -> bool:
        if self.status != AdjustmentStatus.APPROVED:
            return False

        check_time = at_time or datetime.now()

        if self.effective_from and check_time < self.effective_from:
            return False

        if self.effective_to and check_time > self.effective_to:
            return False

        return True


class TraceSampleDecision(BaseModel):
    trace_id: str
    service_name: str
    tags: Dict[str, str]
    sampled: bool
    reason: str
    matched_rule_id: Optional[str] = None
    budget_impact: int = 0
    timestamp: datetime = Field(default_factory=datetime.now)


class BudgetReport(BaseModel):
    service_name: str
    date: str
    daily_budget: int
    used_budget: int
    reserved_budget: int
    remaining_budget: int
    utilization_rate: float
    top_rules: List[Dict[str, Any]]
    recent_adjustments: List[Dict[str, Any]]
    sampling_decisions: List[Dict[str, Any]]
    generated_at: datetime = Field(default_factory=datetime.now)

    def to_machine_readable(self) -> Dict[str, Any]:
        return self.dict()

    def to_human_readable(self) -> str:
        lines = [
            f"=== 预算报告: {self.service_name} ===",
            f"日期: {self.date}",
            f"生成时间: {self.generated_at.strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "--- 预算概览 ---",
            f"日预算总额: {self.daily_budget}",
            f"已使用: {self.used_budget}",
            f"已预留: {self.reserved_budget}",
            f"剩余: {self.remaining_budget}",
            f"利用率: {self.utilization_rate:.1%}",
            "",
        ]

        if self.top_rules:
            lines.extend([
                "--- 热门规则 ---",
                f"{'规则ID':<20} {'标签键':<15} {'优先级':<8} {'采样率':<8}",
                "-" * 55
            ])
            for rule in self.top_rules[:5]:
                lines.append(
                    f"{rule['rule_id']:<20} {rule['tag_key']:<15} "
                    f"{rule['priority']:<8} {rule['sampling_rate']:<8.1%}"
                )
            lines.append("")

        if self.recent_adjustments:
            lines.extend([
                "--- 近期调整 ---",
                f"{'申请ID':<20} {'类型':<15} {'状态':<10} {'申请人'}",
                "-" * 55
            ])
            for adj in self.recent_adjustments[:5]:
                lines.append(
                    f"{adj['request_id']:<20} {adj['adjustment_type']:<15} "
                    f"{adj['status']:<10} {adj['requester']}"
                )

        return "\n".join(lines)
