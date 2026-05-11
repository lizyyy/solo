from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class MigrationStatus(Enum):
    PENDING = 'pending'
    IN_PROGRESS = 'in_progress'
    SUCCESS = 'success'
    FAILED = 'failed'
    SKIPPED = 'skipped'
    NEEDS_REVIEW = 'needs_review'


class CouponStatus(Enum):
    ACTIVE = 'active'
    USED = 'used'
    EXPIRED = 'expired'
    REVOKED = 'revoked'


@dataclass
class OldUser:
    old_user_id: str
    nickname: str
    phone: Optional[str] = None
    points_balance: int = 0
    created_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class UserMapping:
    old_user_id: str
    new_user_id: str
    phone: Optional[str] = None
    mapped_at: Optional[datetime] = None


@dataclass
class PointRecord:
    record_id: str
    old_user_id: str
    points: int
    type: str
    reason: str
    created_at: datetime
    balance_after: Optional[int] = None


@dataclass
class Coupon:
    coupon_id: str
    old_user_id: str
    name: str
    value: float
    value_type: str
    status: CouponStatus = CouponStatus.ACTIVE
    issue_date: Optional[datetime] = None
    expire_date: Optional[datetime] = None
    used_date: Optional[datetime] = None


@dataclass
class PhoneBinding:
    phone: str
    old_user_id: str
    bound_at: datetime


@dataclass
class MigrationItem:
    old_user_id: str
    new_user_id: str
    phone: Optional[str] = None
    points_to_migrate: int = 0
    points_records: List[PointRecord] = field(default_factory=list)
    coupons: List[Coupon] = field(default_factory=list)
    status: MigrationStatus = MigrationStatus.PENDING
    error_reason: Optional[str] = None
    migrated_at: Optional[datetime] = None
    warnings: List[str] = field(default_factory=list)
    retries: int = 0


@dataclass
class MigrationPlan:
    plan_id: str
    created_at: datetime
    total_users: int = 0
    pending_items: List[MigrationItem] = field(default_factory=list)
    validation_errors: List[str] = field(default_factory=list)
    needs_review_items: List[MigrationItem] = field(default_factory=list)


@dataclass
class MigrationResult:
    plan_id: str
    executed_at: datetime
    total_items: int = 0
    success_count: int = 0
    failed_count: int = 0
    skipped_count: int = 0
    success_items: List[MigrationItem] = field(default_factory=list)
    failed_items: List[MigrationItem] = field(default_factory=list)
    skipped_items: List[MigrationItem] = field(default_factory=list)
    is_simulation: bool = True


@dataclass
class SystemState:
    old_users: Dict[str, OldUser] = field(default_factory=dict)
    user_mappings: Dict[str, UserMapping] = field(default_factory=dict)
    point_records: Dict[str, List[PointRecord]] = field(default_factory=dict)
    coupons: Dict[str, List[Coupon]] = field(default_factory=dict)
    phone_bindings: Dict[str, List[PhoneBinding]] = field(default_factory=dict)
    migration_history: Dict[str, MigrationResult] = field(default_factory=dict)
    migrated_users: set = field(default_factory=set)
