from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class UserAccountBase(BaseModel):
    user_id: str
    user_name: Optional[str] = None
    phone: Optional[str] = None
    balance: float = 0.0


class UserAccountCreate(UserAccountBase):
    pass


class UserAccount(UserAccountBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PaymentTransactionBase(BaseModel):
    transaction_id: str
    user_id: str
    amount: float
    currency: str = "CNY"
    pay_channel: Optional[str] = None
    pay_time: Optional[datetime] = None
    pay_status: str = "SUCCESS"
    raw_data: Optional[str] = None


class PaymentTransactionCreate(PaymentTransactionBase):
    pass


class PaymentTransaction(PaymentTransactionBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class OrderDraftBase(BaseModel):
    order_no: Optional[str] = None
    transaction_id: str
    user_id: str
    amount: float
    product_info: Optional[str] = None
    order_status: str = "DRAFT"


class OrderDraftCreate(OrderDraftBase):
    pass


class OrderDraft(OrderDraftBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class HandlerBase(BaseModel):
    handler_id: str
    handler_name: str
    department: Optional[str] = None
    role: Optional[str] = None
    is_active: bool = True


class HandlerCreate(HandlerBase):
    pass


class Handler(HandlerBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class CompensationVoucherBase(BaseModel):
    voucher_code: str
    voucher_type: Optional[str] = None
    amount: float
    min_spend: float = 0.0
    valid_days: int = 30
    is_active: bool = True


class CompensationVoucherCreate(CompensationVoucherBase):
    pass


class CompensationVoucher(CompensationVoucherBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class CompensationRecordBase(BaseModel):
    record_no: Optional[str] = None
    transaction_id: str
    order_no: Optional[str] = None
    user_id: str
    handler_id: str
    voucher_id: Optional[int] = None
    status: str = "PENDING"
    compensation_type: Optional[str] = None
    compensation_amount: Optional[float] = None
    reason: Optional[str] = None
    conclusion: Optional[str] = None
    raw_input: Optional[str] = None


class CompensationRecordCreate(CompensationRecordBase):
    pass


class CompensationRecordUpdate(BaseModel):
    status: Optional[str] = None
    handler_id: Optional[str] = None
    voucher_id: Optional[int] = None
    compensation_type: Optional[str] = None
    compensation_amount: Optional[float] = None
    reason: Optional[str] = None
    conclusion: Optional[str] = None


class CompensationRecord(CompensationRecordBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class OperationLogBase(BaseModel):
    record_id: int
    handler_id: str
    operation: str
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    remark: Optional[str] = None


class OperationLogCreate(OperationLogBase):
    pass


class OperationLog(OperationLogBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class CompensationReportBase(BaseModel):
    record_id: int
    report_no: Optional[str] = None
    transaction_info: Optional[str] = None
    order_info: Optional[str] = None
    user_info: Optional[str] = None
    handler_info: Optional[str] = None
    compensation_info: Optional[str] = None
    operation_history: Optional[str] = None


class CompensationReportCreate(CompensationReportBase):
    pass


class CompensationReport(CompensationReportBase):
    id: int
    created_at: datetime
    exported_at: Optional[datetime] = None
    exported_by: Optional[str] = None

    class Config:
        from_attributes = True


class CompensationRecordDetail(CompensationRecord):
    transaction: Optional[PaymentTransaction] = None
    order: Optional[OrderDraft] = None
    user: Optional[UserAccount] = None
    handler: Optional[Handler] = None
    voucher: Optional[CompensationVoucher] = None
    operation_logs: List[OperationLog] = []
