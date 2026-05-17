from dataclasses import dataclass, field
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from enum import Enum


class DamageLevel(Enum):
    NONE = "无损坏"
    MINOR = "轻微划痕"
    MODERATE = "中度损坏"
    SEVERE = "严重损坏"


class ApprovalStatus(Enum):
    PENDING = "待审批"
    APPROVED = "已批准"
    REJECTED = "已拒绝"


@dataclass
class SourceLocation:
    file_path: str
    sheet_name: Optional[str] = None
    row_number: int = 0
    raw_content: str = ""


@dataclass
class BadRecord:
    source: SourceLocation
    error_message: str
    record_type: str


@dataclass
class Equipment:
    equipment_id: str
    name: str
    category: str
    model: str
    serial_number: str
    purchase_date: date
    daily_rate: float
    deposit_amount: float
    source: Optional[SourceLocation] = None


@dataclass
class AccessoryItem:
    accessory_id: str
    name: str
    quantity: int
    unit_price: float


@dataclass
class RentalOrder:
    order_id: str
    equipment_id: str
    borrower_name: str
    borrower_department: str
    borrow_date: date
    expected_return_date: date
    actual_return_date: Optional[date] = None
    accessories: List[AccessoryItem] = field(default_factory=list)
    deposit_paid: float = 0.0
    source: Optional[SourceLocation] = None


@dataclass
class ReturnInspection:
    inspection_id: str
    order_id: str
    inspector_name: str
    inspection_date: date
    equipment_condition: DamageLevel
    equipment_notes: str = ""
    returned_accessories: List[AccessoryItem] = field(default_factory=list)
    source: Optional[SourceLocation] = None


@dataclass
class DepositDeduction:
    deduction_id: str
    order_id: str
    deduction_type: str
    amount: float
    reason: str
    applicant: str
    approval_status: ApprovalStatus = ApprovalStatus.PENDING
    approver: Optional[str] = None
    approval_date: Optional[date] = None
    source: Optional[SourceLocation] = None


@dataclass
class AccessoryDiscrepancy:
    order_id: str
    accessory_id: str
    accessory_name: str
    expected_quantity: int
    returned_quantity: int
    difference: int
    unit_price: float
    total_loss: float


@dataclass
class OverdueRecord:
    order_id: str
    expected_return_date: date
    actual_return_date: date
    overdue_days: int
    daily_rate: float
    overdue_fee: float


@dataclass
class VerificationResult:
    order_id: str
    borrower_name: str
    equipment_name: str
    equipment_discrepancies: List[str] = field(default_factory=list)
    accessory_discrepancies: List[AccessoryDiscrepancy] = field(default_factory=list)
    overdue_record: Optional[OverdueRecord] = None
    approved_deductions: List[DepositDeduction] = field(default_factory=list)
    pending_deductions: List[DepositDeduction] = field(default_factory=list)
    total_deposit: float = 0.0
    total_deductions: float = 0.0
    refund_amount: float = 0.0
    is_complete: bool = False


@dataclass
class ParsedData:
    equipments: Dict[str, Equipment] = field(default_factory=dict)
    rental_orders: Dict[str, RentalOrder] = field(default_factory=dict)
    return_inspections: Dict[str, ReturnInspection] = field(default_factory=dict)
    deposit_deductions: Dict[str, DepositDeduction] = field(default_factory=dict)
    bad_records: List[BadRecord] = field(default_factory=list)
