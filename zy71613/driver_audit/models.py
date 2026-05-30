from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, date
from enum import Enum
from typing import Optional


class FreezeStatus(str, Enum):
    ACTIVE = "active"
    RELEASED = "released"
    PARTIAL = "partial"


class WithdrawalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    ROLLED_BACK = "rolled_back"
    OVERRIDDEN = "overridden"


class ExceptionSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class DriverAccount:
    driver_id: str
    name: str
    phone: str
    id_card: Optional[str] = None
    bank_account: Optional[str] = None
    registered_at: Optional[date] = None
    raw_data: Optional[dict] = field(default=None, repr=False)

    @property
    def display(self) -> str:
        return f"{self.name}(ID:{self.driver_id}, 手机:{self.phone})"


@dataclass
class OrderIncome:
    order_id: str
    driver_id: str
    amount: float
    order_date: date
    platform_fee: float = 0.0
    passenger_tip: float = 0.0
    raw_data: Optional[dict] = field(default=None, repr=False)

    @property
    def net_income(self) -> float:
        return self.amount - self.platform_fee + self.passenger_tip


@dataclass
class RewardRule:
    reward_id: str
    driver_id: str
    reward_type: str
    amount: float
    reward_date: date
    reason: str = ""
    order_id: Optional[str] = None
    raw_data: Optional[dict] = field(default=None, repr=False)


@dataclass
class FineRecord:
    fine_id: str
    driver_id: str
    amount: float
    fine_date: date
    reason: str = ""
    order_id: Optional[str] = None
    is_deducted: bool = False
    raw_data: Optional[dict] = field(default=None, repr=False)


@dataclass
class FreezeRecord:
    freeze_id: str
    driver_id: str
    amount: float
    freeze_date: date
    reason: str = ""
    status: FreezeStatus = FreezeStatus.ACTIVE
    released_date: Optional[date] = None
    released_amount: float = 0.0
    raw_data: Optional[dict] = field(default=None, repr=False)

    @property
    def frozen_amount(self) -> float:
        if self.status == FreezeStatus.RELEASED:
            return 0.0
        if self.status == FreezeStatus.PARTIAL:
            return self.amount - self.released_amount
        return self.amount


@dataclass
class WithdrawalRecord:
    withdrawal_id: str = field(default_factory=lambda: str(uuid.uuid4())[:12])
    driver_id: str = ""
    amount: float = 0.0
    request_date: date = field(default_factory=date.today)
    status: WithdrawalStatus = WithdrawalStatus.PENDING
    idempotency_key: str = ""
    reviewer: str = ""
    review_note: str = ""
    approved_at: Optional[datetime] = None
    raw_data: Optional[dict] = field(default=None, repr=False)


@dataclass
class ExceptionRecord:
    exception_id: str = field(default_factory=lambda: str(uuid.uuid4())[:12])
    driver_id: str = ""
    category: str = ""
    severity: ExceptionSeverity = ExceptionSeverity.WARNING
    title: str = ""
    detail: str = ""
    suggestion: str = ""
    related_ids: list[str] = field(default_factory=list)
    auto_fixable: bool = False
    fixed: bool = False
    fix_action: str = ""
    created_at: datetime = field(default_factory=datetime.now)

    def human_readable(self) -> str:
        icons = {
            ExceptionSeverity.INFO: "ℹ️",
            ExceptionSeverity.WARNING: "⚠️",
            ExceptionSeverity.ERROR: "❌",
            ExceptionSeverity.CRITICAL: "🚨",
        }
        icon = icons.get(self.severity, "❓")
        fix_tag = ""
        if self.auto_fixable and not self.fixed:
            fix_tag = " [可自动处理]"
        elif self.auto_fixable and self.fixed:
            fix_tag = " [已自动处理]"
        elif not self.auto_fixable:
            fix_tag = " [需人工确认]"

        lines = [
            f"{icon} {self.title}{fix_tag}",
            f"   司机: {self.driver_id} | 类别: {self.category}",
            f"   详情: {self.detail}",
            f"   建议: {self.suggestion}",
        ]
        if self.related_ids:
            lines.append(f"   关联: {', '.join(self.related_ids)}")
        return "\n".join(lines)


@dataclass
class AuditItem:
    driver_id: str
    driver_name: str
    total_income: float = 0.0
    total_rewards: float = 0.0
    total_fines: float = 0.0
    total_frozen: float = 0.0
    withdrawable: float = 0.0
    total_withdrawn: float = 0.0
    exceptions: list[ExceptionRecord] = field(default_factory=list)
    orders: list[OrderIncome] = field(default_factory=list)
    rewards: list[RewardRule] = field(default_factory=list)
    fines: list[FineRecord] = field(default_factory=list)
    freezes: list[FreezeRecord] = field(default_factory=list)


@dataclass
class AuditReport:
    report_id: str = field(default_factory=lambda: str(uuid.uuid4())[:12])
    generated_at: datetime = field(default_factory=datetime.now)
    audit_date: date = field(default_factory=date.today)
    items: list[AuditItem] = field(default_factory=list)
    global_exceptions: list[ExceptionRecord] = field(default_factory=list)
    summary: dict = field(default_factory=dict)
