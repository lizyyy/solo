from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from models import OrderStatus, DeductionType, Role
import uuid


def generate_idempotency_key():
    return str(uuid.uuid4())


class OperatorInfo(BaseModel):
    operator_id: str
    operator_name: str
    operator_role: Role


class OrderBase(BaseModel):
    room_number: str
    room_type: str
    guest_name: Optional[str] = None
    guest_phone: Optional[str] = None
    checkin_date: Optional[datetime] = None
    checkout_date: Optional[datetime] = None
    estimated_amount: float = 0
    remarks: Optional[str] = None


class OrderCreate(OrderBase):
    idempotency_key: str = Field(default_factory=generate_idempotency_key)


class OrderAssign(BaseModel):
    cleaner_id: int
    cleaner_name: str


class OrderComplete(BaseModel):
    completed_at: Optional[datetime] = None


class OrderResponse(OrderBase):
    id: int
    status: OrderStatus
    cleaner_id: Optional[int] = None
    cleaner_name: Optional[str] = None
    assigned_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    final_amount: float
    created_by: str
    created_at: datetime
    updated_by: Optional[str] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AcceptanceBase(BaseModel):
    order_id: int
    passed: bool
    quality_score: Optional[int] = None
    photo_urls: Optional[str] = None
    issues_found: Optional[str] = None
    inspector_id: str
    inspector_name: str
    remarks: Optional[str] = None


class AcceptanceCreate(AcceptanceBase):
    idempotency_key: str = Field(default_factory=generate_idempotency_key)


class AcceptanceResponse(AcceptanceBase):
    id: int
    inspected_at: datetime
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


class ReworkBase(BaseModel):
    order_id: int
    acceptance_id: int
    reason: str
    assigned_to: str
    assigned_name: str
    deadline: datetime
    remarks: Optional[str] = None


class ReworkCreate(ReworkBase):
    idempotency_key: str = Field(default_factory=generate_idempotency_key)


class ReworkComplete(BaseModel):
    completed_at: Optional[datetime] = None


class ReworkResponse(ReworkBase):
    id: int
    completed: bool
    completed_at: Optional[datetime] = None
    rework_count: int
    created_by: str
    created_at: datetime
    updated_by: Optional[str] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DeductionBase(BaseModel):
    order_id: int
    rework_id: Optional[int] = None
    deduction_type: DeductionType
    amount: float
    reason: str
    evidence_urls: Optional[str] = None


class DeductionCreate(DeductionBase):
    idempotency_key: str = Field(default_factory=generate_idempotency_key)


class DeductionApprove(BaseModel):
    approved: bool


class DeductionResponse(DeductionBase):
    id: int
    approved: bool
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


class SettlementBase(BaseModel):
    order_id: int
    cleaner_id: int
    cleaner_name: str
    base_amount: float
    settlement_month: str
    remarks: Optional[str] = None


class SettlementCreate(SettlementBase):
    idempotency_key: str = Field(default_factory=generate_idempotency_key)


class SettlementPay(BaseModel):
    paid: bool


class SettlementResponse(SettlementBase):
    id: int
    total_deductions: float
    final_settlement: float
    paid: bool
    paid_at: Optional[datetime] = None
    paid_by: Optional[str] = None
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_id: int
    operator_id: str
    operator_name: str
    operator_role: Role
    ip_address: Optional[str] = None
    details: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BatchResultItem(BaseModel):
    index: int
    success: bool
    id: Optional[int] = None
    error: Optional[str] = None


class BatchResponse(BaseModel):
    batch_id: str
    total_count: int
    success_count: int
    failed_count: int
    results: List[BatchResultItem]


class OrderQuery(BaseModel):
    room_number: Optional[str] = None
    status: Optional[OrderStatus] = None
    cleaner_id: Optional[int] = None
    created_by: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class DeductionQuery(BaseModel):
    deduction_type: Optional[DeductionType] = None
    approved: Optional[bool] = None
    created_by: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class SettlementQuery(BaseModel):
    cleaner_id: Optional[int] = None
    settlement_month: Optional[str] = None
    paid: Optional[bool] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class AuditLogQuery(BaseModel):
    action: Optional[str] = None
    entity_type: Optional[str] = None
    operator_id: Optional[str] = None
    operator_role: Optional[Role] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
