from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from models import InvoiceStatus

class CustomerBase(BaseModel):
    name: str
    contact: Optional[str] = None
    email: Optional[str] = None

class CustomerCreate(CustomerBase):
    id: str

class CustomerResponse(CustomerBase):
    id: str
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True

class PricingRuleBase(BaseModel):
    version: str
    customer_id: str
    free_quota: int = 0
    price_per_call: float
    effective_date: datetime
    end_date: Optional[datetime] = None
    description: Optional[str] = None

class PricingRuleCreate(PricingRuleBase):
    id: str

class PricingRuleResponse(PricingRuleBase):
    id: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class CallDetailBase(BaseModel):
    customer_id: str
    api_name: str
    call_time: datetime
    response_time_ms: Optional[int] = None
    status_code: Optional[int] = None

class CallDetailCreate(CallDetailBase):
    id: str

class CallDetailResponse(CallDetailBase):
    id: str
    rule_version: Optional[str] = None
    billing_period_id: Optional[str] = None
    is_billed: bool
    created_at: datetime

    class Config:
        from_attributes = True

class CallDetailImport(BaseModel):
    calls: List[CallDetailCreate]

class BillingPeriodBase(BaseModel):
    customer_id: str
    period_start: datetime
    period_end: datetime

class BillingPeriodCreate(BillingPeriodBase):
    id: str

class BillingPeriodResponse(BillingPeriodBase):
    id: str
    is_locked: bool
    locked_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class BillingSummaryResponse(BaseModel):
    id: str
    billing_period_id: str
    rule_version: str
    total_calls: int
    free_calls: int
    billable_calls: int
    base_amount: float
    manual_discount: float
    manual_surcharge: float
    final_amount: float
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class AdjustmentCreate(BaseModel):
    billing_summary_id: str
    adjustment_type: str
    amount: float
    reason: str
    adjusted_by: Optional[str] = None

class AdjustmentResponse(AdjustmentCreate):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True

class InvoiceResponse(BaseModel):
    id: str
    billing_period_id: str
    invoice_number: Optional[str] = None
    total_amount: float
    status: InvoiceStatus
    rejection_reason: Optional[str] = None
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    invoiced_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class InvoiceSubmit(BaseModel):
    billing_period_id: str
    invoice_number: Optional[str] = None

class InvoiceReject(BaseModel):
    rejection_reason: str

class VarianceRecordResponse(BaseModel):
    id: str
    invoice_id: str
    rule_version: Optional[str] = None
    variance_type: str
    expected_amount: float
    actual_amount: float
    variance_amount: float
    description: Optional[str] = None
    source_rule: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class BillingPeriodWithDetails(BillingPeriodResponse):
    summaries: List[BillingSummaryResponse] = []
    invoice: Optional[InvoiceResponse] = None
    variances: List[VarianceRecordResponse] = []

class LockPeriodResponse(BaseModel):
    success: bool
    message: str
    billing_period: BillingPeriodResponse
    summaries: List[BillingSummaryResponse]

class ExportResponse(BaseModel):
    success: bool
    message: str
    file_path: Optional[str] = None
