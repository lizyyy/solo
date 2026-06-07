from dataclasses import dataclass, field
from typing import List, Dict, Optional
from datetime import datetime
from enum import Enum


class DisputeStatus(str, Enum):
    NORMAL = "normal"
    ABNORMAL = "abnormal"
    PENDING = "pending"
    CONFLICT = "conflict"


@dataclass
class ManagerNote:
    original_line_no: int
    customer_id: str
    customer_name: str
    account_no: str
    dispute_amount: float
    note: str
    manager: str
    record_time: datetime
    frozen: bool = False


@dataclass
class CounterTransaction:
    trans_id: str
    customer_id: str
    customer_name: str
    account_no: str
    trans_amount: float
    trans_type: str
    trans_time: datetime
    operator: str


@dataclass
class ValuationRecord:
    valuation_id: str
    customer_id: str
    account_no: str
    dispute_amount: float
    valuation_amount: float
    version: int
    manual_note: str = ""
    valuator: str = ""
    valuation_time: Optional[datetime] = None


@dataclass
class DisputeMatchResult:
    customer_id: str
    customer_name: str
    status: DisputeStatus
    manager_notes: List[ManagerNote] = field(default_factory=list)
    counter_trans: List[CounterTransaction] = field(default_factory=list)
    valuation_records: List[ValuationRecord] = field(default_factory=list)
    conflict_details: List[str] = field(default_factory=list)
    impact_accounts: List[str] = field(default_factory=list)
    total_dispute_amount: float = 0.0
    summary: str = ""
