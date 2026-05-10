from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional, List
from enum import Enum


class PropStatus(str, Enum):
    AVAILABLE = "available"
    BORROWED = "borrowed"
    MAINTENANCE = "maintenance"
    RETIRED = "retired"


class BorrowStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    RETURNED = "returned"
    OVERDUE = "overdue"
    SETTLED = "settled"


class DamageLevel(str, Enum):
    NONE = "none"
    MINOR = "minor"
    MAJOR = "major"
    TOTAL = "total"


@dataclass
class Prop:
    prop_id: str
    name: str
    category: str
    value: float
    deposit_rate: float
    status: PropStatus = PropStatus.AVAILABLE
    location: str = ""
    description: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    last_updated: datetime = field(default_factory=datetime.now)
    
    def required_deposit(self) -> float:
        return self.value * self.deposit_rate
    
    def calculate_damage_fee(self, damage_level: DamageLevel) -> float:
        from .config import RULES
        
        if damage_level == DamageLevel.NONE:
            return 0.0
        
        fee = self.value * (
            0.1 if damage_level == DamageLevel.MINOR else
            0.3 if damage_level == DamageLevel.MAJOR else
            1.0
        )
        
        return max(fee, RULES.MIN_DAMAGE_FEE)


@dataclass
class BorrowRecord:
    borrow_id: str
    prop_id: str
    crew_name: str
    borrow_date: date
    scheduled_return_date: date
    actual_return_date: Optional[date] = None
    required_deposit: float = 0.0
    deposit_paid: float = 0.0
    status: BorrowStatus = BorrowStatus.PENDING
    damage_level: DamageLevel = DamageLevel.NONE
    damage_fee: float = 0.0
    delay_fee: float = 0.0
    refund_amount: float = 0.0
    notes: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    last_updated: datetime = field(default_factory=datetime.now)


@dataclass
class ProblemRecord:
    problem_id: str
    source_file: str
    line_number: int
    data: dict
    error_type: str
    error_message: str
    fixed: bool = False
    created_at: datetime = field(default_factory=datetime.now)
