from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class ExpenseType(str, Enum):
    TRANSPORTATION = "transportation"
    ACCOMMODATION = "accommodation"
    MEAL = "meal"
    OTHER = "other"


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    MANUAL_APPROVED = "manual_approved"


class Itinerary(BaseModel):
    employee_name: str
    employee_id: str
    department: str
    trip_purpose: str
    start_date: date
    end_date: date
    departure_city: str
    arrival_city: str
    approval_number: Optional[str] = None


class Invoice(BaseModel):
    invoice_number: str
    invoice_date: date
    expense_type: ExpenseType
    amount: Decimal = Field(gt=0)
    merchant: str
    description: Optional[str] = None
    days: Optional[int] = 1


class ExpenseRule(BaseModel):
    rule_id: str
    expense_type: ExpenseType
    city_level: str
    max_amount: Decimal
    max_daily_amount: Optional[Decimal] = None
    description: str


class ManualOverride(BaseModel):
    override_id: str
    invoice_number: str
    reason: str
    approved_by: str
    approved_date: datetime
    override_amount: Optional[Decimal] = None


class CheckResult(BaseModel):
    check_name: str
    passed: bool
    message: str
    details: Optional[str] = None


class InvoiceAudit(BaseModel):
    invoice: Invoice
    status: ApprovalStatus
    final_amount: Decimal
    checks: List[CheckResult]
    manual_override: Optional[ManualOverride] = None
    notes: Optional[str] = None


class AuditReport(BaseModel):
    itinerary: Itinerary
    invoices: List[InvoiceAudit]
    total_requested_amount: Decimal
    total_approved_amount: Decimal
    total_rejected_amount: Decimal
    generated_at: datetime
    summary: str
