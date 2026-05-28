from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Dict, Any, List
from datetime import datetime, date
import uuid


class ApplicationType(Enum):
    SUBSCRIBE = "SUBSCRIBE"
    REDEEM = "REDEEM"


class ApplicationStatus(Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    PARTIAL_CONFIRMED = "PARTIAL_CONFIRMED"
    REJECTED = "REJECTED"
    QUEUED = "QUEUED"


class CustomerLevel(Enum):
    NORMAL = "NORMAL"
    VIP = "VIP"
    SVIP = "SVIP"
    INSTITUTION = "INSTITUTION"


class RejectReason(Enum):
    INSUFFICIENT_FUND = "INSUFFICIENT_FUND"
    EXCEED_DAILY_LIMIT = "EXCEED_DAILY_LIMIT"
    HOLIDAY = "HOLIDAY"
    CUSTOMER_LEVEL_MISMATCH = "CUSTOMER_LEVEL_MISMATCH"
    SYSTEM_ERROR = "SYSTEM_ERROR"
    MASS_REDEMPTION = "MASS_REDEMPTION"


@dataclass
class Application:
    app_id: str
    customer_id: str
    customer_name: str
    customer_level: CustomerLevel
    app_type: ApplicationType
    amount: float
    shares: Optional[float]
    app_time: datetime
    trading_day: date
    status: ApplicationStatus = ApplicationStatus.PENDING
    confirmed_amount: float = 0.0
    confirmed_shares: float = 0.0
    confirm_ratio: float = 0.0
    queue_position: int = 0
    reject_reason: Optional[RejectReason] = None
    explanation: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def add_explanation(self, reason: str):
        self.explanation.append(reason)


@dataclass
class FundPool:
    fund_id: str
    fund_name: str
    total_shares: float
    available_cash: float
    total_asset: float
    daily_redeem_limit: float
    mass_redemption_ratio: float = 0.1
    current_redeemed_amount: float = 0.0
    last_update: datetime = field(default_factory=datetime.now)

    def get_remaining_redeem_limit(self) -> float:
        return max(0.0, self.daily_redeem_limit - self.current_redeemed_amount)

    def is_mass_redemption(self, total_request: float) -> bool:
        return total_request >= self.total_asset * self.mass_redemption_ratio


@dataclass
class TradingCalendar:
    calendar_id: str
    year: int
    holidays: set = field(default_factory=set)
    special_trading_days: set = field(default_factory=set)

    def is_trading_day(self, d: date) -> bool:
        if d.weekday() >= 5:
            return False
        if d in self.holidays:
            return False
        if d in self.special_trading_days:
            return True
        return True

    def get_next_trading_day(self, d: date) -> date:
        next_day = d
        while True:
            next_day = date.fromordinal(next_day.toordinal() + 1)
            if self.is_trading_day(next_day):
                return next_day

    def get_previous_trading_day(self, d: date) -> date:
        prev_day = d
        while True:
            prev_day = date.fromordinal(prev_day.toordinal() - 1)
            if self.is_trading_day(prev_day):
                return prev_day


@dataclass
class ConfirmationRule:
    rule_id: str
    rule_name: str
    level_priority: Dict[CustomerLevel, int] = field(default_factory=lambda: {
        CustomerLevel.INSTITUTION: 1,
        CustomerLevel.SVIP: 2,
        CustomerLevel.VIP: 3,
        CustomerLevel.NORMAL: 4
    })
    fifo_enabled: bool = True
    mass_redemption_enabled: bool = True
    min_confirm_ratio: float = 0.0
    max_confirm_ratio: float = 1.0


@dataclass
class SimulationResult:
    simulation_id: str
    simulation_name: str
    start_time: datetime
    end_time: Optional[datetime] = None
    total_applications: int = 0
    confirmed_count: int = 0
    partial_confirmed_count: int = 0
    rejected_count: int = 0
    queued_count: int = 0
    applications: List[Application] = field(default_factory=list)
    fund_pool_snapshots: List[Dict[str, Any]] = field(default_factory=list)
    exceptions: List[Dict[str, Any]] = field(default_factory=list)
    warnings: List[Dict[str, Any]] = field(default_factory=list)

    def add_exception(self, step: str, message: str, details: Dict[str, Any] = None):
        self.exceptions.append({
            "timestamp": datetime.now().isoformat(),
            "step": step,
            "message": message,
            "details": details or {}
        })

    def add_warning(self, step: str, message: str, details: Dict[str, Any] = None):
        self.warnings.append({
            "timestamp": datetime.now().isoformat(),
            "step": step,
            "message": message,
            "details": details or {}
        })
