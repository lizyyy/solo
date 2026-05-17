from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional, List


class ErrorCode:
    MISSING_FIELD = "missing_field"
    INVALID_STATE = "invalid_state"
    NEEDS_MANUAL_REVIEW = "needs_manual_review"
    ALREADY_PROCESSED = "already_processed"
    DUPLICATE_TRANSACTION = "duplicate_transaction"
    INSUFFICIENT_DEPOSIT = "insufficient_deposit"
    BUCKET_NOT_FOUND = "bucket_not_found"
    CUSTOMER_NOT_FOUND = "customer_not_found"


class ErrorResponse(BaseModel):
    code: str
    message: str
    detail: Optional[dict] = None


class CustomerBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=1, max_length=20)
    address: Optional[str] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class Customer(CustomerBase):
    id: int
    total_deposit: float
    used_deposit: float
    available_deposit: float
    pending_buckets: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BucketBase(BaseModel):
    bucket_number: str = Field(..., min_length=1, max_length=50)
    deposit_amount: float = Field(default=50.0, ge=0)


class BucketCreate(BucketBase):
    pass


class Bucket(BucketBase):
    id: int
    status: str
    current_customer_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DeliveryCreate(BaseModel):
    customer_id: int
    delivery_address: str
    quantity: int = Field(..., ge=1)
    bucket_numbers: List[str]
    deposit_per_bucket: float = Field(default=50.0, ge=0)
    use_deposit_credit: float = Field(default=0.0, ge=0)
    notes: Optional[str] = None

    @validator("bucket_numbers")
    def check_bucket_count(cls, v, values):
        if len(v) != values.get("quantity", 0):
            raise ValueError("桶编号数量必须与配送数量一致")
        return v


class Delivery(BaseModel):
    id: int
    order_no: str
    customer_id: int
    delivery_address: str
    quantity: int
    deposit_per_bucket: float
    total_deposit: float
    use_deposit_credit: float
    actual_pay_deposit: float
    status: str
    notes: Optional[str]
    delivered_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class BucketReturnCreate(BaseModel):
    customer_id: int
    bucket_numbers: List[str]
    deduct_amount: float = Field(default=0.0, ge=0)
    notes: Optional[str] = None


class BucketReturn(BaseModel):
    id: int
    return_no: str
    customer_id: int
    quantity: int
    refund_amount: float
    deduct_amount: float
    actual_refund: float
    status: str
    notes: Optional[str]
    returned_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class DepositRecord(BaseModel):
    id: int
    customer_id: int
    transaction_no: str
    amount: float
    record_type: str
    status: str
    related_order_no: Optional[str]
    notes: Optional[str]
    processed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class DepositReportItem(BaseModel):
    customer_id: int
    customer_name: str
    customer_phone: str
    pending_buckets: int
    total_deposit: float
    used_deposit: float
    available_deposit: float
    total_deliveries: int
    total_returns: int


class DepositReport(BaseModel):
    generated_at: datetime
    total_customers: int
    total_pending_buckets: int
    total_deposit_amount: float
    total_available_deposit: float
    items: List[DepositReportItem]
