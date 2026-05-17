from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class RentalStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    RETURNED = "returned"
    OVERDUE = "overdue"
    SETTLED = "settled"


class DepositStatus(str, Enum):
    FROZEN = "frozen"
    RELEASED = "released"
    PARTIAL_DEDUCTED = "partial_deducted"
    FULLY_DEDUCTED = "fully_deducted"


class DamageSeverity(str, Enum):
    MINOR = "minor"
    MODERATE = "moderate"
    SEVERE = "severe"
    TOTAL_LOSS = "total_loss"


class SourceLocation(BaseModel):
    file_path: str
    line_number: Optional[int] = None
    sheet_name: Optional[str] = None
    row_index: Optional[int] = None


class BadRow(BaseModel):
    source: SourceLocation
    raw_data: str
    error_message: str
    error_type: str


class RentalOrder(BaseModel):
    model_config = ConfigDict(extra="forbid")
    
    order_id: str
    customer_id: str
    customer_name: str
    equipment_id: str
    equipment_name: str
    rental_start_date: date
    rental_end_date: date
    daily_rate: Decimal
    deposit_amount: Decimal
    status: RentalStatus
    actual_return_date: Optional[date] = None
    created_at: datetime
    source: SourceLocation


class DepositTransaction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    
    transaction_id: str
    order_id: str
    transaction_type: str
    amount: Decimal
    currency: str = "CNY"
    transaction_date: datetime
    status: DepositStatus
    payment_method: str
    reference_no: Optional[str] = None
    source: SourceLocation


class DamageItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    
    damage_id: str
    order_id: str
    equipment_id: str
    damage_description: str
    severity: DamageSeverity
    repair_cost: Decimal
    reported_date: datetime
    reported_by: str
    photos_attached: List[str] = Field(default_factory=list)
    is_verified: bool = False
    source: SourceLocation


class RenewalApplication(BaseModel):
    model_config = ConfigDict(extra="forbid")
    
    renewal_id: str
    order_id: str
    original_end_date: date
    new_end_date: date
    renewal_days: int
    renewal_fee: Decimal
    application_date: datetime
    approved: Optional[bool] = None
    approved_by: Optional[str] = None
    approved_date: Optional[datetime] = None
    idempotency_key: str
    source: SourceLocation


class SettlementReport(BaseModel):
    model_config = ConfigDict(extra="forbid")
    
    report_id: str
    order_id: str
    report_date: datetime
    
    original_deposit: Decimal
    total_deductions: Decimal
    overdue_charge: Decimal
    damage_charge: Decimal
    other_charges: Decimal
    net_refund: Decimal
    
    rental_days_actual: int
    rental_days_overdue: int
    damage_count: int
    renewal_count: int
    
    transactions: List[str] = Field(default_factory=list)
    damages: List[str] = Field(default_factory=list)
    renewals: List[str] = Field(default_factory=list)
    
    generated_at: datetime = Field(default_factory=datetime.now)
    source: Optional[SourceLocation] = None


class AuditResult(BaseModel):
    order_id: str
    check_timestamp: datetime
    
    deposit_check_passed: bool
    deposit_issues: List[str] = Field(default_factory=list)
    
    overdue_check_passed: bool
    overdue_issues: List[str] = Field(default_factory=list)
    
    damage_check_passed: bool
    damage_issues: List[str] = Field(default_factory=list)
    
    renewal_check_passed: bool
    renewal_issues: List[str] = Field(default_factory=list)
    
    overall_passed: bool
    risk_level: str
    recommended_actions: List[str] = Field(default_factory=list)
