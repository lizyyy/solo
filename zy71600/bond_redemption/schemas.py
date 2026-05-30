from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class ProvenanceBase(BaseModel):
    source_type: str = Field(default="manual", description="email/group_message/spreadsheet/manual/system")
    source_detail: Optional[str] = None
    quality_status: str = Field(default="normal", description="normal/suspect/error")
    anomaly_notes: Optional[List[str]] = None
    created_by: Optional[str] = None


class BondLedgerCreate(ProvenanceBase):
    bond_code: str
    bond_name: str
    issuer: Optional[str] = None
    face_value: float
    coupon_rate: float
    issue_date: Optional[date] = None
    maturity_date: date
    redemption_type: str = "到期赎回"
    status: str = "存续"


class BondLedgerOut(BondLedgerCreate):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CouponScheduleCreate(ProvenanceBase):
    bond_id: int
    payment_date: date
    coupon_amount: float
    coupon_period: Optional[str] = None
    is_paid: bool = False


class CouponScheduleOut(CouponScheduleCreate):
    id: int
    is_duplicate: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RedemptionNoticeCreate(ProvenanceBase):
    bond_id: int
    notice_date: date
    redemption_date: date
    redemption_price: float
    notice_version: Optional[int] = None
    notice_title: Optional[str] = None


class RedemptionNoticeOut(RedemptionNoticeCreate):
    id: int
    is_latest: bool
    is_late: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CustodyReceiptCreate(ProvenanceBase):
    bond_id: int
    receipt_date: date
    receipt_amount: float
    custodian: Optional[str] = None
    receipt_no: Optional[str] = None


class CustodyReceiptOut(CustodyReceiptCreate):
    id: int
    is_matched: bool
    matched_to: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FundCalendarCreate(ProvenanceBase):
    calendar_date: date
    expected_inflow: float = 0.0
    expected_outflow: float = 0.0
    actual_inflow: Optional[float] = None
    actual_outflow: Optional[float] = None
    description: Optional[str] = None


class FundCalendarOut(FundCalendarCreate):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WarningSheetCreate(ProvenanceBase):
    bond_id: Optional[int] = None
    warning_type: str
    warning_level: str = "info"
    description: str
    affected_records: Optional[List[dict]] = None
    status: str = "open"


class WarningSheetOut(WarningSheetCreate):
    id: int
    resolution: Optional[str]
    resolved_by: Optional[str]
    resolved_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WarningResolve(BaseModel):
    resolution: str
    resolved_by: str


class BatchEntryResult(BaseModel):
    inserted: int
    flagged: List[dict]
    errors: List[dict]


class CashFlowItem(BaseModel):
    date: date
    bond_code: str
    bond_name: str
    flow_type: str
    amount: float
    source_table: str
    source_id: int
    quality_status: str
    anomaly_notes: Optional[List[str]] = None


class CashFlowSchedule(BaseModel):
    items: List[CashFlowItem]
    total_outflow: float
    total_inflow: float
    gap_items: List[CashFlowItem]
    warnings: List[dict]


class ReceiptMatchResult(BaseModel):
    matched: List[dict]
    missing_receipt: List[dict]
    unmatched_receipt: List[dict]


class ProcessResult(BaseModel):
    cashflow_schedule: CashFlowSchedule
    receipt_match: ReceiptMatchResult
    new_warnings: List[dict]
    processing_order: List[str]
