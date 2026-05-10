from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field


class StoreBase(BaseModel):
    store_code: str
    store_name: str
    city: Optional[str] = None
    address: Optional[str] = None
    manager: Optional[str] = None


class StoreCreate(StoreBase):
    pass


class StoreResponse(StoreBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True


class AccountBase(BaseModel):
    member_id: Optional[str] = None
    member_name: Optional[str] = None


class AccountCreate(AccountBase):
    pass


class AccountResponse(AccountBase):
    id: int
    account_no: str
    principal_balance: Decimal
    bonus_balance: Decimal
    total_balance: Decimal
    total_deposited: Decimal
    total_bonus: Decimal
    total_consumed: Decimal
    total_refunded: Decimal
    is_active: bool

    class Config:
        from_attributes = True


class BonusRuleBase(BaseModel):
    rule_name: str
    min_deposit_amount: Decimal
    max_deposit_amount: Optional[Decimal] = None
    bonus_amount: Decimal = Field(default=Decimal("0"))
    bonus_rate: Decimal = Field(default=Decimal("0"))
    is_percentage: bool = False
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class BonusRuleCreate(BonusRuleBase):
    pass


class BonusRuleResponse(BonusRuleBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True


class DepositCreate(BaseModel):
    account_no: str
    store_id: int
    deposit_amount: Decimal
    operator: Optional[str] = None
    remark: Optional[str] = None


class DepositResponse(BaseModel):
    id: int
    order_no: str
    account_id: int
    store_id: int
    deposit_amount: Decimal
    bonus_amount: Decimal
    principal_remaining: Decimal
    bonus_remaining: Decimal
    status: str

    class Config:
        from_attributes = True


class ConsumeCreate(BaseModel):
    account_no: str
    store_id: int
    total_amount: Decimal
    operator: Optional[str] = None
    remark: Optional[str] = None


class ConsumeResponse(BaseModel):
    id: int
    order_no: str
    account_id: int
    store_id: int
    total_amount: Decimal
    principal_paid: Decimal
    bonus_paid: Decimal
    other_paid: Decimal
    refundable_amount: Decimal
    status: str

    class Config:
        from_attributes = True


class RefundRequestCreate(BaseModel):
    account_no: str
    store_id: int
    requested_amount: Decimal
    reason_type: Optional[str] = None
    reason_detail: Optional[str] = None
    operator: Optional[str] = None


class RefundCalcPreview(BaseModel):
    total_refund: Decimal
    principal_refund: Decimal
    bonus_refund: Decimal
    bonus_forfeit: Decimal


class RefundApprove(BaseModel):
    request_id: int
    approver: Optional[str] = None
    approval_remark: Optional[str] = None


class RefundReject(BaseModel):
    request_id: int
    reject_reason: str
    operator: Optional[str] = None


class RefundWithdraw(BaseModel):
    request_id: int
    withdraw_reason: str
    operator: Optional[str] = None


class RefundVoid(BaseModel):
    refund_order_id: int
    void_reason: str
    operator: Optional[str] = None


class RefundRequestResponse(BaseModel):
    id: int
    request_no: str
    account_id: int
    store_id: int
    requested_amount: Decimal
    status: str
    reason_type: Optional[str]
    is_withdrawn: bool

    class Config:
        from_attributes = True


class RefundOrderResponse(BaseModel):
    id: int
    order_no: str
    account_id: int
    store_id: int
    total_refund: Decimal
    principal_refund: Decimal
    bonus_refund: Decimal
    bonus_forfeit: Decimal
    status: str

    class Config:
        from_attributes = True


class SettlementCreate(BaseModel):
    store_id: int
    settlement_period: str
    operator: Optional[str] = None


class SettlementResponse(BaseModel):
    id: int
    settlement_no: str
    store_id: int
    settlement_period: str
    deposit_count: int
    deposit_amount: Decimal
    consume_count: int
    consume_amount: Decimal
    refund_count: int
    refund_amount: Decimal
    net_amount: Decimal
    status: str

    class Config:
        from_attributes = True


class JournalResponse(BaseModel):
    id: int
    journal_no: str
    account_id: int
    biz_type: str
    biz_order_no: str
    direction: str
    principal_delta: Decimal
    bonus_delta: Decimal
    total_delta: Decimal
    principal_balance_after: Decimal
    bonus_balance_after: Decimal
    total_balance_after: Decimal
    operator: Optional[str]
    remark: Optional[str]

    class Config:
        from_attributes = True
