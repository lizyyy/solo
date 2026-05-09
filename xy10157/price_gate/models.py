from __future__ import annotations
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, ConfigDict


class RuleType(str, Enum):
    DIRECT_DISCOUNT = "direct_discount"
    MULTIBUY = "multibuy"
    COUPON = "coupon"
    CATEGORY = "category"
    BRAND = "brand"


class RuleStatus(str, Enum):
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    BLOCKED = "blocked"
    ACTIVE = "active"
    INACTIVE = "inactive"
    REVERTED = "reverted"


class ConflictSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class PriceRule(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str = Field(..., description="规则唯一标识")
    name: str = Field(..., description="规则名称")
    type: RuleType = Field(..., description="规则类型")
    status: RuleStatus = Field(default=RuleStatus.DRAFT)
    priority: int = Field(default=0, description="优先级，数字越大优先级越高")
    skus: List[str] = Field(default_factory=list, description="适用的 SKU 列表")
    categories: List[str] = Field(default_factory=list, description="适用的类目列表")
    brands: List[str] = Field(default_factory=list, description="适用的品牌列表")
    discount_value: Optional[float] = Field(default=None, description="折扣值")
    discount_percent: Optional[float] = Field(default=None, description="折扣百分比")
    buy_count: Optional[int] = Field(default=None, description="买多少件")
    get_free: Optional[int] = Field(default=None, description="赠多少件")
    min_amount: Optional[float] = Field(default=None, description="最低消费金额")
    coupon_code: Optional[str] = Field(default=None, description="优惠码")
    valid_from: Optional[datetime] = Field(default=None, description="生效开始时间")
    valid_to: Optional[datetime] = Field(default=None, description="生效结束时间")
    can_overlay: bool = Field(default=True, description="是否可叠加其他规则")
    exclude_rule_ids: List[str] = Field(default_factory=list, description="排除不能叠加的规则")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    version: int = Field(default=1, description="版本号")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="元数据")


class SKUInfo(BaseModel):
    model_config = ConfigDict(extra="allow")

    sku: str = Field(..., description="SKU 编码")
    name: str = Field(default="", description="商品名称")
    original_price: float = Field(..., description="原价")
    category: Optional[str] = Field(default=None, description="类目")
    brand: Optional[str] = Field(default=None, description="品牌")
    quantity: int = Field(default=1, description="数量")


class OrderItem(BaseModel):
    sku: str = Field(..., description="SKU 编码")
    quantity: int = Field(default=1)
    original_price: float = Field(..., description="单价")
    applied_discounts: List[str] = Field(default_factory=list, description="应用的折扣规则 ID 列表")
    final_price: float = Field(..., description="折后单价")
    total_final: float = Field(default=0, description="商品小计")


class SampleOrder(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str = Field(..., description="样例订单 ID")
    name: str = Field(default="", description="样例名称")
    description: str = Field(default="", description="样例描述")
    items: List[OrderItem] = Field(default_factory=list)
    expected_total_original: float = Field(default=0, description="预期原价合计")
    expected_total_final: float = Field(default=0, description="预期折后合计")
    applied_coupons: List[str] = Field(default_factory=list, description="应用的优惠码")
    created_at: datetime = Field(default_factory=datetime.now)


class Conflict(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    rule_ids: List[str]
    severity: ConflictSeverity
    description: str
    affected_skus: List[str] = Field(default_factory=list)
    suggestion: Optional[str] = Field(default=None)


class ValidationResult(BaseModel):
    model_config = ConfigDict(extra="allow")

    success: bool
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    conflicts: List[Conflict] = Field(default_factory=list)
    sample_results: List[Dict[str, Any]] = Field(default_factory=list)


class RuleVersion(BaseModel):
    model_config = ConfigDict(extra="allow")

    rule_id: str
    version: int
    data: PriceRule
    snapshot_at: datetime
    action: str
    actor: Optional[str] = None


class HistoryRecord(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    type: str
    timestamp: datetime
    details: Dict[str, Any]
    version_snapshot: Optional[RuleVersion] = None


class DirtyRecord(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    source: str
    raw_data: str
    error: str
    timestamp: datetime
    retries: int = Field(default=0)


class PlaybackResult(BaseModel):
    model_config = ConfigDict(extra="allow")

    sample_id: str
    passed: bool
    expected: float
    actual: float
    diff: float
    applied_rules: List[str] = Field(default_factory=list)
    items: List[Dict[str, Any]] = Field(default_factory=list)
    message: Optional[str] = None
