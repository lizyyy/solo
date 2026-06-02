from enum import Enum
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class SettlementStatus(str, Enum):
    IMPORTED = "imported"
    TAX_RATE_REVIEWED = "tax_rate_reviewed"
    SUMMARY_UPDATED = "summary_updated"
    PENDING_RISK_REVIEW = "pending_risk_review"
    RISK_APPROVED = "risk_approved"
    REVERSED = "reversed"


class ProcessingStep(str, Enum):
    STEP_1_IMPORT = "step_1_ex_date_import"
    STEP_2_TAX_REVIEW = "step_2_tax_rate_review"
    STEP_3_SUMMARY = "step_3_summary_update"


class RecordSource(str, Enum):
    EX_DATE_SCREENSHOT = "ex_date_screenshot"
    TAX_REPORT = "tax_report"
    MANUAL_ENTRY = "manual_entry"


class AuditAction(str, Enum):
    CREATED = "created"
    STATUS_CHANGED = "status_changed"
    MANUAL_EDIT = "manual_edit"
    REVERSED = "reversed"
    RISK_REVIEWED = "risk_reviewed"


class SettlementRecord(BaseModel):
    id: str
    original_row_number: int
    source: RecordSource
    trade_date: str
    settlement_date: str
    currency_pair: str
    amount: float
    original_amount: float
    rate: float
    status: SettlementStatus
    current_step: ProcessingStep
    remark: str = ""
    is_reversed: bool = False
    has_zero_amount_with_reversal: bool = False
    tax_rate: Optional[float] = None
    tax_rate_remark: Optional[str] = None
    ex_date_evidence_id: Optional[str] = None
    risk_review_required: bool = False
    risk_review_note: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    created_by: str = "system"
    updated_by: str = "system"
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AuditLog(BaseModel):
    id: str
    record_id: str
    action: AuditAction
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    operator: str
    timestamp: datetime = Field(default_factory=datetime.now)
    note: Optional[str] = None
