from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
import uuid


def generate_idempotency_key():
    return str(uuid.uuid4())


class CustomerBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = Field(None, max_length=200)
    id_card: Optional[str] = Field(None, max_length=50)
    remark: Optional[str] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = Field(None, max_length=200)
    id_card: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None
    remark: Optional[str] = None


class CustomerResponse(CustomerBase):
    id: int
    created_at: datetime
    updated_at: datetime
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class CreditOrderItemBase(BaseModel):
    product_batch: str = Field(..., min_length=1, max_length=100)
    product_name: str = Field(..., min_length=1, max_length=100)
    quantity: float = Field(..., gt=0)
    unit_price: float = Field(..., gt=0)
    unit: Optional[str] = Field(None, max_length=20)
    specification: Optional[str] = Field(None, max_length=100)


class CreditOrderItemCreate(CreditOrderItemBase):
    pass


class CreditOrderItemResponse(CreditOrderItemBase):
    id: int
    order_id: int
    total_price: float
    return_quantity: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CreditOrderBase(BaseModel):
    customer_id: int
    order_date: Optional[datetime] = None
    discount_amount: Optional[float] = Field(0.0, ge=0)
    remark: Optional[str] = None


class CreditOrderCreate(CreditOrderBase):
    items: List[CreditOrderItemCreate]
    idempotency_key: Optional[str] = Field(default_factory=generate_idempotency_key)


class CreditOrderUpdate(BaseModel):
    discount_amount: Optional[float] = Field(None, ge=0)
    status: Optional[str] = None
    remark: Optional[str] = None


class CreditOrderResponse(CreditOrderBase):
    id: int
    order_no: str
    total_amount: float
    return_amount: float
    paid_amount: float
    debt_amount: float
    status: str
    created_at: datetime
    updated_at: datetime
    items: List[CreditOrderItemResponse]

    model_config = ConfigDict(from_attributes=True)


class ReturnRecordBase(BaseModel):
    order_id: int
    product_batch: str = Field(..., min_length=1, max_length=100)
    product_name: str = Field(..., min_length=1, max_length=100)
    quantity: float = Field(..., gt=0)
    unit_price: float = Field(..., gt=0)
    reason: Optional[str] = Field(None, max_length=200)
    return_date: Optional[datetime] = None


class ReturnRecordCreate(ReturnRecordBase):
    idempotency_key: Optional[str] = Field(default_factory=generate_idempotency_key)


class ReturnRecordResponse(ReturnRecordBase):
    id: int
    return_no: str
    total_amount: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaymentBase(BaseModel):
    customer_id: int
    order_id: Optional[int] = None
    amount: float = Field(..., gt=0)
    payment_method: Optional[str] = Field(None, max_length=50)
    payment_date: Optional[datetime] = None
    remark: Optional[str] = None


class PaymentCreate(PaymentBase):
    idempotency_key: Optional[str] = Field(default_factory=generate_idempotency_key)


class PaymentResponse(PaymentBase):
    id: int
    payment_no: str
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DebtReportRequest(BaseModel):
    customer_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class DebtReportResponse(BaseModel):
    id: int
    report_no: str
    customer_id: Optional[int]
    customer_name: Optional[str]
    report_date: datetime
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    total_debt: float
    total_paid: float
    total_return: float
    net_debt: float
    order_count: int
    status: str
    file_path: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ManualCorrectionRequest(BaseModel):
    order_id: int
    new_debt_amount: float = Field(..., ge=0)
    correction_reason: str = Field(..., min_length=1)
    corrected_by: str = Field(..., min_length=1)


class ExceptionLogResponse(BaseModel):
    id: int
    request_id: Optional[str]
    endpoint: Optional[str]
    method: Optional[str]
    raw_input: Optional[str]
    error_message: Optional[str]
    error_type: Optional[str]
    resolution: Optional[str]
    status: str
    created_at: datetime
    resolved_at: Optional[datetime]
    resolved_by: Optional[str]

    model_config = ConfigDict(from_attributes=True)


class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None
    request_id: Optional[str] = None
