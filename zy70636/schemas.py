from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from models import AuditType, OperationType


class CustomerBase(BaseModel):
    name: str = Field(..., max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    contact: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = Field(None, max_length=200)


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(CustomerBase):
    is_active: Optional[bool] = None


class Customer(CustomerBase):
    id: int
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class CategoryBase(BaseModel):
    name: str = Field(..., max_length=50)
    code: str = Field(..., max_length=20)
    description: Optional[str] = Field(None, max_length=200)


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(CategoryBase):
    is_active: Optional[bool] = None


class Category(CategoryBase):
    id: int
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class PriceBase(BaseModel):
    category_id: int
    price: float
    effective_date: datetime


class PriceCreate(PriceBase):
    created_by: str


class Price(PriceBase):
    id: int
    version: int
    is_active: bool
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


class DeductionRatioBase(BaseModel):
    category_id: int
    name: str
    ratio: float
    effective_date: datetime


class DeductionRatioCreate(DeductionRatioBase):
    created_by: str


class DeductionRatio(DeductionRatioBase):
    id: int
    version: int
    is_active: bool
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


class WeighingCreate(BaseModel):
    record_no: str
    customer_id: int
    category_id: int
    gross_weight: float
    tare_weight: float
    weigher: str
    created_by: str


class WeighingPrice(BaseModel):
    price_id: int
    operator: str


class WeighingDeduction(BaseModel):
    deduction_id: int
    operator: str


class WeighingManualCorrection(BaseModel):
    gross_weight: Optional[float] = None
    tare_weight: Optional[float] = None
    price_id: Optional[int] = None
    deduction_id: Optional[int] = None
    operator: str
    reason: str


class WeighingClose(BaseModel):
    operator: str
    reason: str


class Weighing(BaseModel):
    id: int
    record_no: str
    customer_id: int
    category_id: int
    gross_weight: float
    tare_weight: float
    net_weight: Optional[float]
    status: str
    weigher: Optional[str]
    weighed_at: Optional[datetime]
    price_id: Optional[int]
    deduction_id: Optional[int]
    deducted_weight: Optional[float]
    final_weight: Optional[float]
    settlement_id: Optional[int]
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime
    remarks: Optional[str]

    class Config:
        from_attributes = True


class SettlementCreate(BaseModel):
    settlement_no: str
    customer_id: int
    weighing_ids: List[int]
    settled_by: str


class SettlementReview(BaseModel):
    reviewed_by: str
    approved: bool
    remarks: Optional[str] = None


class Settlement(BaseModel):
    id: int
    settlement_no: str
    customer_id: int
    total_weight: Optional[float]
    total_amount: Optional[float]
    status: str
    settled_by: Optional[str]
    settled_at: datetime
    reviewed_by: Optional[str]
    reviewed_at: Optional[datetime]
    created_at: datetime
    remarks: Optional[str]

    class Config:
        from_attributes = True


class AuditLog(BaseModel):
    id: int
    weighing_id: Optional[int]
    operation_type: str
    original_data: Optional[str]
    new_data: Optional[str]
    operator: Optional[str]
    conclusion: Optional[str]
    is_success: Optional[int]
    error_message: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class APIResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None
