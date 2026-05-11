from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime


@dataclass
class GroupCheckup:
    company_name: str
    company_id: str
    allowed_items: List[str] = field(default_factory=list)
    forbidden_items: List[str] = field(default_factory=list)
    discount_rate: float = 1.0
    contract_number: str = ""


@dataclass
class Employee:
    employee_id: str
    name: str
    id_card: str
    company_id: str
    package_id: str
    checkup_date: str


@dataclass
class Package:
    package_id: str
    package_name: str
    base_items: List[str] = field(default_factory=list)
    base_price: float = 0.0


@dataclass
class AddOn:
    add_on_id: str
    employee_id: str
    item_code: str
    item_name: str
    quantity: int
    unit_price: float
    operator: str
    timestamp: str
    status: str = "pending"


@dataclass
class Payment:
    payment_id: str
    employee_id: str
    add_on_id: str
    item_code: str
    amount: float
    payment_method: str
    operator: str
    timestamp: str
    status: str = "completed"


@dataclass
class DiscountPolicy:
    policy_id: str
    policy_name: str
    company_id: Optional[str] = None
    item_code: Optional[str] = None
    discount_rate: float = 1.0
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None


@dataclass
class Refund:
    refund_id: str
    original_payment_id: str
    employee_id: str
    amount: float
    operator: str
    timestamp: str
    reason: str = ""
    status: str = "completed"


@dataclass
class CheckResult:
    employee_id: str
    employee_name: str
    company_name: str
    add_on_id: str
    item_code: str
    item_name: str
    quantity: int
    unit_price: float
    discount_rate: float
    expected_amount: float
    paid_amount: float
    refund_amount: float
    status: str
    issue_type: Optional[str] = None
    issue_description: Optional[str] = None


@dataclass
class CheckSession:
    session_id: str
    created_at: datetime
    status: str
    results: List[CheckResult] = field(default_factory=list)
    total_pending: int = 0
    total_issues: int = 0
    total_normal: int = 0
