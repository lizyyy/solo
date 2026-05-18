from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class LeaderBase(BaseModel):
    leader_code: str
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None


class LeaderCreate(LeaderBase):
    pass


class LeaderResponse(LeaderBase):
    id: int
    created_at: datetime
    is_active: bool
    
    class Config:
        from_attributes = True


class CommissionRuleBase(BaseModel):
    leader_id: Optional[int] = None
    tier_min: float
    tier_max: Optional[float] = None
    commission_rate: float


class CommissionRuleCreate(CommissionRuleBase):
    pass


class CommissionRuleResponse(CommissionRuleBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class OrderBase(BaseModel):
    order_no: str
    leader_id: int
    user_name: Optional[str] = None
    user_phone: Optional[str] = None
    total_amount: float
    product_count: int = 1


class OrderCreate(OrderBase):
    pass


class OrderResponse(OrderBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime
    is_duplicate: bool
    duplicate_of: Optional[int] = None
    settlement_id: Optional[int] = None
    
    class Config:
        from_attributes = True


class RefundBase(BaseModel):
    refund_no: str
    order_id: int
    refund_amount: float
    refund_reason: Optional[str] = None


class RefundCreate(RefundBase):
    pass


class RefundResponse(RefundBase):
    id: int
    status: str
    created_at: datetime
    processed_at: Optional[datetime] = None
    processed_by: Optional[str] = None
    settlement_id: Optional[int] = None
    
    class Config:
        from_attributes = True


class SettlementBase(BaseModel):
    leader_id: int
    start_date: datetime
    end_date: datetime


class SettlementCreate(SettlementBase):
    pass


class SettlementResponse(SettlementBase):
    id: int
    settlement_no: str
    total_order_amount: float
    total_refund_amount: float
    net_order_amount: float
    service_fee: float
    commission_amount: float
    final_leader_amount: float
    status: str
    created_at: datetime
    processed_at: Optional[datetime] = None
    processed_by: Optional[str] = None
    
    orders: List[OrderResponse] = []
    refunds: List[RefundResponse] = []
    
    class Config:
        from_attributes = True


class AdjustmentBase(BaseModel):
    settlement_id: int
    adjustment_type: str
    amount: float
    reason: str
    processed_by: str


class AdjustmentCreate(AdjustmentBase):
    pass


class AdjustmentResponse(AdjustmentBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    settlement_id: Optional[int] = None
    action: str
    original_input: Optional[str] = None
    processed_by: str
    conclusion: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class SettlementCalculateRequest(BaseModel):
    settlement_id: int
    processed_by: str


class SettlementProcessRequest(BaseModel):
    settlement_id: int
    processed_by: str


class SettlementCloseRequest(BaseModel):
    settlement_id: int
    processed_by: str
    close_reason: str


class OrderCreateRequest(BaseModel):
    order_no: str
    leader_id: int
    user_name: Optional[str] = None
    user_phone: Optional[str] = None
    total_amount: float
    product_count: int = 1
    processed_by: str


class RefundCreateRequest(BaseModel):
    refund_no: str
    order_id: int
    refund_amount: float
    refund_reason: Optional[str] = None
    processed_by: str


class SettlementCreateRequest(BaseModel):
    leader_id: int
    start_date: datetime
    end_date: datetime
    processed_by: str
