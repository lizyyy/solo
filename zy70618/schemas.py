from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional, List
from enum import Enum


class ErrorCode(str, Enum):
    MISSING_FIELD = "missing_field"
    INVALID_STATUS = "invalid_status"
    NEED_REVIEW = "need_review"
    ALREADY_PROCESSED = "already_processed"
    NOT_FOUND = "not_found"
    BUSINESS_ERROR = "business_error"


class ErrorResponse(BaseModel):
    code: ErrorCode
    message: str
    details: Optional[dict] = None


class CustomerBase(BaseModel):
    name: str = Field(..., max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = Field(None, max_length=200)
    village: Optional[str] = Field(None, max_length=100)


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(CustomerBase):
    is_active: Optional[bool] = None


class CustomerResponse(CustomerBase):
    id: int
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class SalesOrderItemBase(BaseModel):
    product_name: str = Field(..., max_length=100)
    product_batch: Optional[str] = Field(None, max_length=50)
    unit: Optional[str] = Field(None, max_length=20)
    quantity: float = Field(..., gt=0)
    unit_price: float = Field(..., ge=0)


class SalesOrderItemCreate(SalesOrderItemBase):
    pass


class SalesOrderItemResponse(SalesOrderItemBase):
    id: int
    total_price: float
    returned_quantity: float

    class Config:
        from_attributes = True


class SalesOrderBase(BaseModel):
    customer_id: int
    discount_amount: Optional[float] = Field(0.0, ge=0)
    remarks: Optional[str] = None


class SalesOrderCreate(SalesOrderBase):
    items: List[SalesOrderItemCreate]
    order_date: Optional[datetime] = None


class SalesOrderUpdate(BaseModel):
    discount_amount: Optional[float] = Field(None, ge=0)
    status: Optional[str] = None
    remarks: Optional[str] = None


class SalesOrderResponse(SalesOrderBase):
    id: int
    order_no: str
    order_date: datetime
    total_amount: float
    actual_amount: float
    paid_amount: float
    returned_amount: float
    debt_amount: float
    status: str
    created_at: datetime
    items: List[SalesOrderItemResponse]

    class Config:
        from_attributes = True


class ReturnItemBase(BaseModel):
    order_item_id: int
    quantity: float = Field(..., gt=0)
    reason: Optional[str] = Field(None, max_length=200)


class ReturnItemCreate(ReturnItemBase):
    pass


class ReturnItemResponse(ReturnItemBase):
    id: int
    product_name: str
    unit_price: float
    total_price: float

    class Config:
        from_attributes = True


class ReturnRecordBase(BaseModel):
    order_id: int
    remarks: Optional[str] = None


class ReturnRecordCreate(ReturnRecordBase):
    items: List[ReturnItemCreate]
    return_date: Optional[datetime] = None
    idempotent_key: Optional[str] = None


class ReturnRecordResponse(ReturnRecordBase):
    id: int
    return_no: str
    return_date: datetime
    total_amount: float
    deduction_amount: float
    status: str
    items: List[ReturnItemResponse]

    class Config:
        from_attributes = True


class PaymentRecordBase(BaseModel):
    order_id: int
    amount: float = Field(..., gt=0)
    payment_method: Optional[str] = Field(None, max_length=50)
    remarks: Optional[str] = None


class PaymentRecordCreate(PaymentRecordBase):
    payment_date: Optional[datetime] = None
    idempotent_key: Optional[str] = None


class PaymentRecordResponse(PaymentRecordBase):
    id: int
    payment_no: str
    payment_date: datetime
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class RecalculateRequest(BaseModel):
    order_id: int


class RecalculateResponse(BaseModel):
    order_id: int
    order_no: str
    previous_debt: float
    new_debt: float
    total_paid: float
    total_returned: float
    difference: float


class DebtReportRequest(BaseModel):
    customer_id: Optional[int] = None
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None


class DebtReportResponse(BaseModel):
    id: int
    report_no: str
    report_date: datetime
    customer_id: Optional[int]
    customer_name: Optional[str]
    period_start: Optional[datetime]
    period_end: Optional[datetime]
    total_debt: float
    total_paid: float
    total_returned: float
    final_debt: float
    status: str
    need_review: bool
    review_remarks: Optional[str]

    class Config:
        from_attributes = True
