from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class RecordInput(BaseModel):
    lc_number: str = Field(..., description="信用证编号")
    applicant: Optional[str] = None
    beneficiary: Optional[str] = None
    amount_raw: Optional[str] = Field(None, description="原始金额文本，可能带币种")
    date_raw: Optional[str] = Field(None, description="原始日期文本，格式可能混乱")
    operator_name: Optional[str] = Field(None, description="经办人，可能是外号")
    source: str = Field("import", description="来源: import / bank_receipt_screenshot / manual")
    source_detail: Optional[str] = Field(None, description="来源详细描述")
    voucher_reference: Optional[str] = Field(None, description="凭证编号")


class BatchInput(BaseModel):
    batch_id: str
    description: Optional[str] = None
    records: list[RecordInput]


class ConflictItem(BaseModel):
    field_name: str
    imported_value: Optional[str]
    screenshot_value: Optional[str]
    suggested_action: Optional[str]
    resolution: str = "pending"


class ConfirmRequest(BaseModel):
    record_id: int
    action: str = Field(..., description="confirm / suspend / resolve_conflict")
    conflict_resolutions: Optional[list[dict]] = None
    note: Optional[str] = None


class RecordOutput(BaseModel):
    id: int
    batch_id: str
    lc_number: str
    applicant: Optional[str]
    beneficiary: Optional[str]
    amount_raw: Optional[str]
    amount: Optional[float]
    currency: Optional[str]
    date_raw: Optional[str]
    date: Optional[str]
    operator_name: Optional[str]
    source: str
    source_detail: Optional[str]
    voucher_reference: Optional[str]
    has_voucher: bool
    status: str
    conflict_detail: Optional[list] = None
    suggested_action: Optional[str]
    verification_note: Optional[str]
    conflicts: list[dict] = []
    created_at: Optional[str]
    updated_at: Optional[str]


class BatchOutput(BaseModel):
    batch_id: str
    description: Optional[str]
    created_at: Optional[str]
    total: int = 0
    confirmed: int = 0
    suspended: int = 0
    pending: int = 0
    conflict: int = 0


class ReportOutput(BaseModel):
    batch_id: str
    generated_at: str
    summary: dict
    records: list[dict]
    suspended_records: list[dict]
    conflict_records: list[dict]
