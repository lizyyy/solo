from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class CreditLedgerCreate(BaseModel):
    customer_id: str
    customer_name: str
    credit_type: str
    credit_amount: float
    used_amount: float = 0.0
    frozen_amount: float = 0.0
    available_amount: float = 0.0
    status: str = "active"
    effective_date: Optional[str] = None
    expiry_date: Optional[str] = None
    source: Optional[str] = None
    remarks: Optional[str] = None


class CreditLedgerOut(BaseModel):
    id: int
    customer_id: str
    customer_name: str
    credit_type: str
    credit_amount: float
    used_amount: float
    frozen_amount: float
    available_amount: float
    status: str
    effective_date: Optional[str]
    expiry_date: Optional[str]
    source: Optional[str]
    remarks: Optional[str]
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TransactionFlowCreate(BaseModel):
    transaction_no: str
    customer_id: str
    customer_name: str
    transaction_type: str
    amount: float
    occupation_type: Optional[str] = None
    transaction_date: Optional[str] = None
    credit_id: Optional[int] = None
    batch_no: Optional[str] = None


class TransactionFlowOut(BaseModel):
    id: int
    transaction_no: str
    customer_id: str
    customer_name: str
    transaction_type: str
    amount: float
    occupation_type: Optional[str]
    transaction_date: Optional[str]
    credit_id: Optional[int]
    version: int
    batch_no: Optional[str]
    is_supplementary: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WriteoffCreate(BaseModel):
    customer_id: str
    customer_name: str
    occupation_amount: float
    writeoff_amount: float = 0.0
    occupation_type: Optional[str] = None
    credit_id: Optional[int] = None
    transaction_ids: List[int] = []
    conclusion: Optional[str] = None
    remarks: Optional[str] = None


class WriteoffReview(BaseModel):
    status: str
    conclusion: Optional[str] = None
    reviewer: Optional[str] = None
    remarks: Optional[str] = None


class WriteoffCorrect(BaseModel):
    occupation_amount: Optional[float] = None
    writeoff_amount: Optional[float] = None
    occupation_type: Optional[str] = None
    conclusion: Optional[str] = None
    remarks: Optional[str] = None
    risk_tags: Optional[List[str]] = None
    operator: Optional[str] = None


class WriteoffOut(BaseModel):
    id: int
    customer_id: str
    customer_name: str
    occupation_amount: float
    writeoff_amount: float
    occupation_type: Optional[str]
    status: str
    credit_id: Optional[int]
    transaction_ids: List[int] = []
    conclusion: Optional[str]
    evidence_refs: dict = {}
    risk_tags: List[str] = []
    remarks: Optional[str]
    reviewer: Optional[str]
    review_date: Optional[datetime] = None
    version: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WriteoffTraceOut(BaseModel):
    writeoff: WriteoffOut
    credit: Optional[CreditLedgerOut] = None
    transactions: List[TransactionFlowOut] = []
    change_logs: List["ChangeLogOut"] = []


class ChangeLogOut(BaseModel):
    id: int
    writeoff_id: int
    change_type: str
    old_value: Optional[str]
    new_value: Optional[str]
    change_description: Optional[str]
    alert_level: str
    operator: Optional[str]
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CreditAlertOut(BaseModel):
    id: int
    credit_id: int
    alert_type: str
    alert_detail: Optional[str]
    status: str
    resolved_by: Optional[str]
    resolved_at: Optional[datetime]
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SupplementaryAlert(BaseModel):
    writeoff_id: int
    customer_id: str
    changed_fields: List[str]
    old_values: dict
    new_values: dict
    alert_level: str
    description: str
