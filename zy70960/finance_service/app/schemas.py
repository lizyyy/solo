from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class BatchBase(BaseModel):
    batch_no: str
    store_code: str
    batch_type: str
    source_file: Optional[str] = None
    created_by: Optional[str] = None
    remarks: Optional[str] = None


class BatchCreate(BatchBase):
    pass


class BatchUpdate(BaseModel):
    status: Optional[str] = None
    remarks: Optional[str] = None


class BatchResponse(BatchBase):
    id: int
    record_count: int
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DepositRecordBase(BaseModel):
    store_code: str
    deposit_date: datetime
    deposit_amount: float
    deposit_bank: Optional[str] = None
    deposit_slip_no: Optional[str] = None
    cashier: Optional[str] = None
    remarks: Optional[str] = None


class DepositRecordCreate(DepositRecordBase):
    batch_id: int


class DepositRecordUpdate(BaseModel):
    status: Optional[str] = None
    mismatch_reason: Optional[str] = None
    handled_by: Optional[str] = None
    handled_at: Optional[datetime] = None
    remarks: Optional[str] = None
    is_duplicate: Optional[bool] = None
    is_holiday_delay: Optional[bool] = None


class DepositRecordResponse(DepositRecordBase):
    id: int
    batch_id: int
    is_duplicate: bool
    is_holiday_delay: bool
    status: str
    mismatch_reason: Optional[str] = None
    handled_by: Optional[str] = None
    handled_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SalesRecordBase(BaseModel):
    store_code: str
    sale_date: datetime
    sale_amount: float
    payment_method: Optional[str] = None
    transaction_no: Optional[str] = None
    cashier: Optional[str] = None
    remarks: Optional[str] = None


class SalesRecordCreate(SalesRecordBase):
    batch_id: int


class SalesRecordResponse(SalesRecordBase):
    id: int
    batch_id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class PettyCashRecordBase(BaseModel):
    store_code: str
    account_no: str
    trans_date: datetime
    trans_type: str
    trans_amount: float
    balance: Optional[float] = None
    purpose: Optional[str] = None
    handler: Optional[str] = None
    voucher_no: Optional[str] = None
    remarks: Optional[str] = None


class PettyCashRecordCreate(PettyCashRecordBase):
    batch_id: int


class PettyCashRecordResponse(PettyCashRecordBase):
    id: int
    batch_id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ProcessLogBase(BaseModel):
    action: str
    action_type: Optional[str] = None
    reason: str
    handled_by: str
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    remarks: Optional[str] = None


class ProcessLogCreate(ProcessLogBase):
    batch_id: Optional[int] = None
    deposit_record_id: Optional[int] = None


class ProcessLogResponse(ProcessLogBase):
    id: int
    batch_id: Optional[int] = None
    deposit_record_id: Optional[int] = None
    handled_at: datetime

    class Config:
        from_attributes = True


class ProcessActionRequest(BaseModel):
    record_ids: List[int]
    action: str
    reason: str
    handled_by: str
    remarks: Optional[str] = None
    action_type: Optional[str] = None


class QueryParams(BaseModel):
    store_code: Optional[str] = None
    batch_no: Optional[str] = None
    account_no: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    page: int = 1
    page_size: int = 100


class BatchDetailResponse(BatchResponse):
    deposit_records: List[DepositRecordResponse] = []
    sales_records: List[SalesRecordResponse] = []
    petty_cash_records: List[PettyCashRecordResponse] = []
    process_logs: List[ProcessLogResponse] = []
