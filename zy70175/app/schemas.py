from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field

from app.models import (
    ReceiptStatus,
    ClaimStatus,
    InvoiceStatus,
    RefundStatus,
)


class ReceiptCreate(BaseModel):
    receipt_no: str
    amount: Decimal
    paid_at: datetime
    payer_name: Optional[str] = None
    payer_account: Optional[str] = None
    payer_bank: Optional[str] = None
    remark: Optional[str] = None


class ReceiptOut(BaseModel):
    id: int
    receipt_no: str
    amount: Decimal
    paid_at: datetime
    payer_name: Optional[str]
    payer_account: Optional[str]
    payer_bank: Optional[str]
    remark: Optional[str]
    status: ReceiptStatus
    remaining_amount: Decimal
    created_at: datetime

    class Config:
        from_attributes = True


class ContractCreate(BaseModel):
    contract_no: str
    contract_name: str
    customer_name: str
    total_amount: Decimal
    signed_at: Optional[datetime] = None


class ContractOut(BaseModel):
    id: int
    contract_no: str
    contract_name: str
    customer_name: str
    total_amount: Decimal
    received_amount: Decimal
    signed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class InvoiceCreate(BaseModel):
    invoice_no: str
    contract_id: int
    amount: Decimal
    issued_at: Optional[datetime] = None


class InvoiceOut(BaseModel):
    id: int
    invoice_no: str
    contract_id: int
    amount: Decimal
    reconciled_amount: Decimal
    status: InvoiceStatus
    issued_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class MatchResultItem(BaseModel):
    contract_id: int
    contract_no: str
    contract_name: str
    customer_name: str
    score: float
    match_reason: str


class MatchResult(BaseModel):
    receipt_id: int
    receipt_no: str
    matches: List[MatchResultItem]


class ClaimCreate(BaseModel):
    receipt_id: int
    contract_id: int
    amount: Decimal
    applicant: str
    applicant_remark: Optional[str] = None


class ClaimOut(BaseModel):
    id: int
    claim_no: str
    receipt_id: int
    contract_id: int
    amount: Decimal
    status: ClaimStatus
    applicant: str
    applicant_remark: Optional[str]
    approver: Optional[str]
    approve_remark: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ClaimApprove(BaseModel):
    approver: str
    approve_remark: Optional[str] = None


class ClaimReject(BaseModel):
    approver: str
    approve_remark: Optional[str] = None


class ReconciliationItem(BaseModel):
    invoice_id: int
    amount: Decimal


class ReconciliationCreate(BaseModel):
    claim_id: Optional[int] = None
    items: List[ReconciliationItem]


class ReconciliationOut(BaseModel):
    id: int
    claim_id: int
    invoice_id: int
    amount: Decimal
    reconciled_at: datetime

    class Config:
        from_attributes = True


class RefundCreate(BaseModel):
    receipt_id: int
    amount: Decimal
    reason: Optional[str] = None
    operator: str


class RefundOut(BaseModel):
    id: int
    refund_no: str
    receipt_id: int
    amount: Decimal
    reason: Optional[str]
    status: RefundStatus
    operator: str
    processed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class RefundProcess(BaseModel):
    success: bool
    operator: str


class FinancialReportQuery(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class FinancialReportRow(BaseModel):
    period: str
    total_receipts: Decimal
    total_claimed: Decimal
    total_reconciled: Decimal
    total_refunded: Decimal
    unmatched_count: int


class FinancialReport(BaseModel):
    rows: List[FinancialReportRow]
    summary: dict


class OperationLogOut(BaseModel):
    id: int
    target_type: str
    target_id: int
    action: str
    from_status: Optional[str]
    to_status: Optional[str]
    operator: Optional[str]
    reason: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class APIError(BaseModel):
    code: str
    message: str
    detail: Optional[str] = None
