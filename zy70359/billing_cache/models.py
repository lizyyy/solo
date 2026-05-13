from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from enum import Enum


class DiscountType(str, Enum):
    PERCENTAGE = "percentage"
    FIXED_AMOUNT = "fixed_amount"
    FREE_MONTHS = "free_months"


class CouponStatus(str, Enum):
    ACTIVE = "active"
    USED = "used"
    EXPIRED = "expired"


class InvalidationReason(str, Enum):
    RULE_VERSION_CHANGED = "rule_version_changed"
    USER_COUPON_CHANGED = "user_coupon_changed"
    REFUND_EVENT = "refund_event"
    CACHE_EXPIRED = "cache_expired"
    EXPLICIT_INVALIDATION = "explicit_invalidation"


class Plan(BaseModel):
    id: str
    name: str
    base_price: float
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Coupon(BaseModel):
    id: str
    code: str
    type: DiscountType
    value: float
    description: Optional[str] = None
    min_amount: Optional[float] = None
    max_discount: Optional[float] = None
    valid_from: datetime = Field(default_factory=datetime.utcnow)
    valid_until: Optional[datetime] = None
    status: CouponStatus = CouponStatus.ACTIVE
    created_at: datetime = Field(default_factory=datetime.utcnow)


class UserCoupon(BaseModel):
    user_id: str
    coupon_id: str
    assigned_at: datetime = Field(default_factory=datetime.utcnow)
    used_at: Optional[datetime] = None


class PriceRule(BaseModel):
    id: str
    version: int
    name: str
    description: Optional[str] = None
    effective_from: datetime = Field(default_factory=datetime.utcnow)
    effective_until: Optional[datetime] = None
    is_active: bool = True
    discount_percent: Optional[float] = None
    tax_rate: float = 0.13
    created_at: datetime = Field(default_factory=datetime.utcnow)


class BillingRequest(BaseModel):
    user_id: str
    plan_id: str
    coupon_ids: List[str] = Field(default_factory=list)
    quantity: int = 1
    billing_period_months: int = 1
    metadata: Dict[str, Any] = Field(default_factory=dict)


class BillLineItem(BaseModel):
    name: str
    description: Optional[str] = None
    quantity: int = 1
    unit_price: float
    amount: float


class BillingResult(BaseModel):
    trial_id: str
    request: BillingRequest
    plan: Plan
    applied_coupons: List[Coupon] = Field(default_factory=list)
    line_items: List[BillLineItem] = Field(default_factory=list)
    subtotal: float
    discount_amount: float
    tax_amount: float
    total_amount: float
    price_rule_id: str
    price_rule_version: int
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_cached: bool = False


class CacheKeyComponents(BaseModel):
    user_id: str
    plan_id: str
    coupon_ids: List[str]
    quantity: int
    billing_period_months: int
    metadata_hash: str


class CacheRecord(BaseModel):
    cache_key: str
    key_components: CacheKeyComponents
    price_rule_id: str
    price_rule_version: int
    user_coupon_version: int
    billing_result: BillingResult
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    invalidated: bool = False
    invalidation_reason: Optional[InvalidationReason] = None
    invalidated_at: Optional[datetime] = None


class InvalidationEvent(BaseModel):
    id: str
    type: str
    affected_user_id: Optional[str] = None
    affected_plan_id: Optional[str] = None
    affected_coupon_id: Optional[str] = None
    affected_rule_id: Optional[str] = None
    reason: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class CacheQueryResult(BaseModel):
    trial_id: str
    cache_key: str
    price_rule_id: str
    price_rule_version: int
    user_coupon_version: int
    is_hit: bool
    invalidation_reason: Optional[str] = None
    invalidation_events: List[InvalidationEvent] = Field(default_factory=list)
    created_at: datetime
    expires_at: Optional[datetime] = None
    result: Optional[BillingResult] = None


class CacheHitReportItem(BaseModel):
    trial_id: str
    cache_key: str
    cache_key_components: CacheKeyComponents
    price_rule_id: str
    price_rule_version: int
    user_coupon_version: int
    is_hit: bool
    invalidation_reason: Optional[InvalidationReason] = None
    invalidation_events: List[InvalidationEvent] = Field(default_factory=list)
    created_at: datetime
    expires_at: Optional[datetime] = None


class CacheHitReport(BaseModel):
    total_requests: int
    hit_count: int
    miss_count: int
    hit_rate: float
    items: List[CacheHitReportItem]
