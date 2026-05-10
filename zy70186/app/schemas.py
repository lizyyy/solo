from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models import (
    ContractStatus, DepositStatus, TransactionType, 
    TransactionStatus, ApprovalStatus
)


class ContractBase(BaseModel):
    contract_no: str
    contract_name: str
    party_a: str
    party_b: str
    total_amount: float = 0.0
    deposit_rate: float = 0.0
    required_deposit_amount: float = 0.0
    status: ContractStatus = ContractStatus.DRAFT
    sign_date: Optional[datetime] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    remarks: Optional[str] = None


class ContractCreate(ContractBase):
    pass


class ContractUpdate(BaseModel):
    contract_name: Optional[str] = None
    party_a: Optional[str] = None
    party_b: Optional[str] = None
    total_amount: Optional[float] = None
    deposit_rate: Optional[float] = None
    required_deposit_amount: Optional[float] = None
    status: Optional[ContractStatus] = None
    end_date: Optional[datetime] = None
    remarks: Optional[str] = None


class ContractResponse(ContractBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class DepositAccountResponse(BaseModel):
    id: int
    contract_id: int
    account_no: str
    required_amount: float
    paid_amount: float
    released_amount: float
    deducted_amount: float
    current_balance: float
    status: DepositStatus
    last_transaction_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class DepositRequest(BaseModel):
    idempotent_key: str
    contract_id: int
    amount: float = Field(..., gt=0)
    reference_no: Optional[str] = None
    operator: Optional[str] = None
    payment_method: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    payer_name: Optional[str] = None
    payment_date: Optional[datetime] = None
    remarks: Optional[str] = None


class ReleaseRequest(BaseModel):
    idempotent_key: str
    contract_id: int
    amount: float = Field(..., gt=0)
    reference_no: Optional[str] = None
    operator: Optional[str] = None
    release_condition_id: Optional[int] = None
    remarks: Optional[str] = None


class PenaltyApplyRequest(BaseModel):
    contract_id: int
    penalty_amount: float = Field(..., gt=0)
    penalty_reason: str
    penalty_type: Optional[str] = None
    contract_node: Optional[str] = None
    applicant: Optional[str] = None
    idempotent_key: Optional[str] = None


class PenaltyApprovalRequest(BaseModel):
    approval_no: str
    action: str
    approver: Optional[str] = None
    rejection_reason: Optional[str] = None
    idempotent_key: Optional[str] = None


class TransactionResponse(BaseModel):
    id: int
    transaction_no: str
    contract_id: int
    account_id: int
    transaction_type: TransactionType
    amount: float
    status: TransactionStatus
    idempotent_key: str
    reference_no: Optional[str] = None
    operator: Optional[str] = None
    processed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    retry_count: int
    created_at: datetime
    remarks: Optional[str] = None
    
    class Config:
        from_attributes = True


class PaymentReceiptResponse(BaseModel):
    id: int
    receipt_no: str
    account_id: int
    transaction_id: int
    amount: float
    payment_method: Optional[str] = None
    bank_name: Optional[str] = None
    payer_name: Optional[str] = None
    payment_date: Optional[datetime] = None
    verified: bool
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class ReleaseConditionCreate(BaseModel):
    account_id: int
    condition_name: str
    description: Optional[str] = None
    release_amount: float
    contract_node: Optional[str] = None
    sort_order: int = 1


class ReleaseConditionResponse(BaseModel):
    id: int
    account_id: int
    condition_name: str
    description: Optional[str] = None
    release_amount: float
    is_met: bool
    met_at: Optional[datetime] = None
    met_by: Optional[str] = None
    contract_node: Optional[str] = None
    sort_order: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class PenaltyApprovalResponse(BaseModel):
    id: int
    approval_no: str
    contract_id: int
    account_id: int
    transaction_id: Optional[int] = None
    penalty_amount: float
    penalty_reason: str
    penalty_type: Optional[str] = None
    contract_node: Optional[str] = None
    status: ApprovalStatus
    applicant: Optional[str] = None
    apply_time: Optional[datetime] = None
    approver: Optional[str] = None
    approval_time: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class BalanceSnapshotResponse(BaseModel):
    id: int
    snapshot_no: str
    contract_id: int
    account_id: int
    required_amount: float
    paid_amount: float
    released_amount: float
    deducted_amount: float
    current_balance: float
    snapshot_type: Optional[str] = None
    reference_transaction_id: Optional[int] = None
    taken_by: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class ContractReportResponse(BaseModel):
    contract_id: int
    contract_no: str
    contract_name: str
    required_deposit_amount: float
    paid_amount: float
    released_amount: float
    deducted_amount: float
    current_balance: float
    deposit_status: DepositStatus
    pending_release_conditions: int
    total_transactions: int


class BackgroundTaskResponse(BaseModel):
    id: int
    task_id: str
    task_type: str
    related_id: Optional[int] = None
    related_type: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    retry_count: int
    max_retry: int
    last_run_at: Optional[datetime] = None
    next_run_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class RetryTaskRequest(BaseModel):
    task_id: str
    force: bool = False


class IdempotentCheckRequest(BaseModel):
    idempotent_key: str


class MessageResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None
