from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from models import (
    OrderStatus, ReturnStatus, CompensationStatus, 
    DamageType, MaterialCategory
)


class MaterialBase(BaseModel):
    name: str
    category: MaterialCategory
    quantity: int
    unit_price: float
    description: Optional[str] = None


class MaterialCreate(MaterialBase):
    pass


class Material(MaterialBase):
    id: int
    order_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class OrderBase(BaseModel):
    order_no: str
    customer_name: str
    customer_phone: str
    event_date: datetime
    event_location: str
    notes: Optional[str] = None


class OrderCreate(OrderBase):
    materials: List[MaterialCreate]


class OrderUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    event_date: Optional[datetime] = None
    event_location: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[OrderStatus] = None


class Order(OrderBase):
    id: int
    status: OrderStatus
    total_materials: int
    total_compensation: float
    created_at: datetime
    updated_at: Optional[datetime] = None
    materials: List[Material] = []

    class Config:
        from_attributes = True


class OutboundItemBase(BaseModel):
    material_id: int
    quantity: int


class OutboundItemCreate(OutboundItemBase):
    pass


class OutboundItem(OutboundItemBase):
    id: int
    outbound_id: int

    class Config:
        from_attributes = True


class OutboundBase(BaseModel):
    operator: str
    notes: Optional[str] = None


class OutboundCreate(OutboundBase):
    order_id: int
    items: List[OutboundItemCreate]


class Outbound(OutboundBase):
    id: int
    order_id: int
    outbound_no: str
    outbound_time: datetime
    items: List[OutboundItem] = []

    class Config:
        from_attributes = True


class ReturnItemBase(BaseModel):
    material_id: int
    expected_quantity: int
    returned_quantity: int = 0
    damage_type: DamageType = DamageType.NONE
    damage_notes: Optional[str] = None


class ReturnItemCreate(ReturnItemBase):
    pass


class ReturnItemUpdate(BaseModel):
    returned_quantity: Optional[int] = None
    damage_type: Optional[DamageType] = None
    damage_notes: Optional[str] = None


class ReturnItem(ReturnItemBase):
    id: int
    return_id: int

    class Config:
        from_attributes = True


class ReturnBase(BaseModel):
    operator: str
    notes: Optional[str] = None


class ReturnCreate(ReturnBase):
    order_id: int
    items: List[ReturnItemCreate]


class ReturnReview(BaseModel):
    reviewed_by: str
    review_notes: Optional[str] = None
    status: ReturnStatus


class Return(ReturnBase):
    id: int
    order_id: int
    return_no: str
    return_time: datetime
    status: ReturnStatus
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    items: List[ReturnItem] = []

    class Config:
        from_attributes = True


class CompensationBase(BaseModel):
    damage_type: DamageType
    quantity: int
    unit_amount: float
    notes: Optional[str] = None


class CompensationCreate(CompensationBase):
    order_id: int
    return_id: int
    material_id: int


class CompensationUpdate(BaseModel):
    status: Optional[CompensationStatus] = None
    paid_by: Optional[str] = None
    notes: Optional[str] = None


class Compensation(CompensationBase):
    id: int
    order_id: int
    compensation_no: str
    return_id: int
    material_id: int
    status: CompensationStatus
    total_amount: float
    created_at: datetime
    paid_at: Optional[datetime] = None
    paid_by: Optional[str] = None

    class Config:
        from_attributes = True


class ReportBase(BaseModel):
    report_type: str
    generated_by: str


class ReportCreate(ReportBase):
    order_id: int
    content: str


class Report(ReportBase):
    id: int
    order_id: int
    report_no: str
    generated_at: datetime
    content: str
    file_path: Optional[str] = None

    class Config:
        from_attributes = True


class ProcessingExceptionBase(BaseModel):
    exception_type: str
    operation: str
    original_input: str
    error_message: str
    processing_result: str


class ProcessingExceptionCreate(ProcessingExceptionBase):
    order_id: Optional[int] = None


class ProcessingExceptionHandle(BaseModel):
    handled_by: str
    correction_notes: Optional[str] = None


class ProcessingException(ProcessingExceptionBase):
    id: int
    order_id: Optional[int] = None
    handled: bool
    handled_by: Optional[str] = None
    handled_at: Optional[datetime] = None
    correction_notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ApiResponse(BaseModel):
    success: bool
    code: str
    message: str
    data: Optional[dict] = None


class OrderListResponse(BaseModel):
    success: bool
    code: str
    message: str
    data: List[Order]
    total: int
    page: int
    page_size: int