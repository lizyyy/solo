"""数据模型定义"""

from datetime import date
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator


class TrancheType(str, Enum):
    SENIOR = "senior"
    MEZZANINE = "mezzanine"
    SUBORDINATED = "subordinated"
    EQUITY = "equity"


class AssetStatus(str, Enum):
    PERFORMING = "performing"
    DELINQUENT = "delinquent"
    DEFAULTED = "defaulted"
    RECOVERED = "recovered"
    WRITTEN_OFF = "written_off"


class PaymentType(str, Enum):
    PRINCIPAL = "principal"
    INTEREST = "interest"
    PRINCIPAL_AND_INTEREST = "principal_and_interest"
    SERVICING_FEE = "servicing_fee"
    RECOVERY = "recovery"
    LATE_FEE = "late_fee"


class TriggerEventType(str, Enum):
    ACCELERATION = "acceleration"
    DEFAULT = "default"
    STEPDOWN = "stepdown"
    CASH_TRAP = "cash_trap"
    REINVESTMENT = "reinvestment"


class TriggerStatus(str, Enum):
    NOT_TRIGGERED = "not_triggered"
    TRIGGERED = "triggered"
    WAIVED = "waived"
    CURED = "cured"


class UnderlyingAsset(BaseModel):
    asset_id: str
    original_balance: float
    current_balance: float
    coupon_rate: float
    origination_date: date
    maturity_date: date
    status: AssetStatus
    borrower_id: Optional[str] = None
    collateral_type: Optional[str] = None
    custom_fields: Dict[str, Any] = Field(default_factory=dict)


class CashFlowRecord(BaseModel):
    record_id: str
    asset_id: str
    payment_date: date
    payment_type: PaymentType
    amount: float
    is_recovery: bool = False
    recovery_asset_id: Optional[str] = None
    source_account: Optional[str] = None
    reference: Optional[str] = None
    custom_fields: Dict[str, Any] = Field(default_factory=dict)


class Tranche(BaseModel):
    tranche_id: str
    tranche_name: str
    tranche_type: TrancheType
    original_balance: float
    current_balance: float
    coupon_rate: float
    payment_priority: int
    payment_type: PaymentType
    is_shortfall_carry: bool = True
    custom_fields: Dict[str, Any] = Field(default_factory=dict)


class ServicingFee(BaseModel):
    fee_id: str
    fee_name: str
    rate: float
    calculation_base: str
    payment_priority: int
    is_flat_fee: bool = False
    flat_amount: Optional[float] = None
    arrears: float = 0.0
    custom_fields: Dict[str, Any] = Field(default_factory=dict)


class DefaultRecord(BaseModel):
    default_id: str
    asset_id: str
    default_date: date
    original_default_amount: float
    remaining_default_amount: float
    recovery_amount: float = 0.0
    write_off_amount: float = 0.0
    custom_fields: Dict[str, Any] = Field(default_factory=dict)


class TriggerEvent(BaseModel):
    event_id: str
    event_name: str
    event_type: TriggerEventType
    test_formula: str
    threshold: float
    actual_value: float = 0.0
    status: TriggerStatus = TriggerStatus.NOT_TRIGGERED
    test_date: Optional[date] = None
    cure_period: int = 0
    custom_fields: Dict[str, Any] = Field(default_factory=dict)


class AllocationReportSample(BaseModel):
    sample_id: str
    report_date: date
    tranche_id: str
    expected_payment_type: PaymentType
    expected_amount: float
    actual_amount: float = 0.0
    variance: float = 0.0
    is_matched: bool = False
    custom_fields: Dict[str, Any] = Field(default_factory=dict)


class DealStructure(BaseModel):
    deal_id: str
    deal_name: str
    closing_date: date
    next_payment_date: date
    assets: List[UnderlyingAsset] = Field(default_factory=list)
    cashflows: List[CashFlowRecord] = Field(default_factory=list)
    tranches: List[Tranche] = Field(default_factory=list)
    servicing_fees: List[ServicingFee] = Field(default_factory=list)
    default_records: List[DefaultRecord] = Field(default_factory=list)
    trigger_events: List[TriggerEvent] = Field(default_factory=list)
    allocation_samples: List[AllocationReportSample] = Field(default_factory=list)
    reserve_account_balance: float = 0.0
    collection_account_balance: float = 0.0
    reinvestment_account_balance: float = 0.0


class PaymentAllocation(BaseModel):
    tranche_id: str
    tranche_name: str
    payment_type: PaymentType
    scheduled_amount: float
    paid_amount: float
    shortfall_amount: float
    carried_shortfall: float
    source_account: str
    is_from_recovery: bool = False
    recovery_asset_id: Optional[str] = None


class FeePayment(BaseModel):
    fee_id: str
    fee_name: str
    scheduled_amount: float
    paid_amount: float
    shortfall_amount: float
    carried_shortfall: float
    source_account: str


class DiscrepancyType(str, Enum):
    RECOVERY_WRONG_TRANCHE = "recovery_wrong_tranche"
    DUPLICATE_FEE_DEDUCTION = "duplicate_fee_deduction"
    TRIGGER_EVENT_MISSED = "trigger_event_missed"
    CASHFLOW_NOT_ALLOCATED = "cashflow_not_allocated"
    WRONG_PRIORITY_ORDER = "wrong_priority_order"
    SHORTFALL_NOT_CARRIED = "shortfall_not_carried"
    BALANCE_MISMATCH = "balance_mismatch"
    SAMPLE_VARIANCE_EXCEEDED = "sample_variance_exceeded"


class Discrepancy(BaseModel):
    discrepancy_id: str
    discrepancy_type: DiscrepancyType
    severity: str
    description: str
    affected_records: List[str]
    expected_value: Optional[float] = None
    actual_value: Optional[float] = None
    related_tranche: Optional[str] = None
    related_asset: Optional[str] = None
    explanation: str


class WaterfallResult(BaseModel):
    period_start_date: date
    period_end_date: date
    total_cash_inflow: float
    total_cash_outflow: float
    beginning_collection_balance: float
    ending_collection_balance: float
    beginning_reserve_balance: float
    ending_reserve_balance: float
    fee_payments: List[FeePayment] = Field(default_factory=list)
    tranche_payments: List[PaymentAllocation] = Field(default_factory=list)
    trigger_results: List[TriggerEvent] = Field(default_factory=list)
    discrepancies: List[Discrepancy] = Field(default_factory=list)
    raw_cashflows_used: List[CashFlowRecord] = Field(default_factory=list)
    original_values_preserved: Dict[str, Any] = Field(default_factory=dict)
