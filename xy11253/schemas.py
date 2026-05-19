from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum


class OrderStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class ShortageStatus(str, Enum):
    IDENTIFIED = "identified"
    CONFIRMED = "confirmed"
    COMPENSATED = "compensated"
    SETTLED = "settled"
    CANCELLED = "cancelled"


class CompensationType(str, Enum):
    REFUND = "refund"
    EXCHANGE = "exchange"
    COUPON = "coupon"
    PARTIAL_REFUND = "partial_refund"


class CompensationStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    PROCESSED = "processed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


class CouponStatus(str, Enum):
    ACTIVE = "active"
    USED = "used"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class SettlementStatus(str, Enum):
    PENDING = "pending"
    PROCESSED = "processed"
    RECONCILED = "reconciled"


class Role(str, Enum):
    ADMIN = "admin"
    OPERATOR = "operator"
    FINANCE = "finance"
    CUSTOMER_SERVICE = "customer_service"
    VIEWER = "viewer"


class OperatorContext(BaseModel):
    operator_role: Role
    operator_id: str
    operator_name: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class RuleCheckResult(BaseModel):
    passed: bool
    rule_code: str
    rule_name: str
    reason: str


class OperationResult(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None
    rule_results: List[RuleCheckResult] = []


class OrderItemBase(BaseModel):
    product_id: str
    product_name: str
    quantity: int
    unit_price: float


class OrderItemCreate(OrderItemBase):
    pass


class OrderItemResponse(OrderItemBase):
    id: int
    subtotal: float
    is_shortage: bool
    shortage_quantity: int

    class Config:
        from_attributes = True


class OrderBase(BaseModel):
    order_no: str
    customer_id: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    total_amount: float


class OrderCreate(OrderBase):
    items: List[OrderItemCreate]
    delivery_date: Optional[date] = None


class OrderResponse(OrderBase):
    id: int
    status: OrderStatus
    order_date: datetime
    delivery_date: Optional[date] = None
    items: List[OrderItemResponse]

    class Config:
        from_attributes = True


class ShortageIdentifyRequest(BaseModel):
    order_no: str
    product_id: str
    shortage_quantity: int
    remark: Optional[str] = None
    idempotent_key: Optional[str] = None


class ShortageConfirmRequest(BaseModel):
    shortage_no: str
    confirmed: bool = True
    remark: Optional[str] = None
    idempotent_key: Optional[str] = None


class CompensationRequest(BaseModel):
    shortage_no: str
    compensation_type: CompensationType
    amount: Optional[float] = None
    coupon_value: Optional[float] = None
    coupon_expiry_days: Optional[int] = 30
    exchange_product_id: Optional[str] = None
    exchange_product_name: Optional[str] = None
    remark: Optional[str] = None
    idempotent_key: Optional[str] = None


class RollbackRequest(BaseModel):
    compensation_no: str
    reason: str
    idempotent_key: Optional[str] = None


class SettlementRequest(BaseModel):
    start_date: date
    end_date: date
    remark: Optional[str] = None
    idempotent_key: Optional[str] = None


class ShortageRecordResponse(BaseModel):
    id: int
    shortage_no: str
    order_id: int
    product_id: str
    product_name: str
    shortage_quantity: int
    shortage_amount: float
    status: ShortageStatus
    identified_by: Optional[str] = None
    identified_at: Optional[datetime] = None
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    remark: Optional[str] = None

    class Config:
        from_attributes = True


class CompensationRecordResponse(BaseModel):
    id: int
    compensation_no: str
    shortage_id: int
    compensation_type: CompensationType
    amount: float
    coupon_id: Optional[str] = None
    coupon_value: float
    status: CompensationStatus
    operator_role: Optional[str] = None
    operator_name: Optional[str] = None
    processed_at: Optional[datetime] = None
    remark: Optional[str] = None

    class Config:
        from_attributes = True


class SettlementRecordResponse(BaseModel):
    id: int
    settlement_no: str
    settlement_date: date
    total_shortage_count: int
    total_shortage_amount: float
    total_refund_amount: float
    total_coupon_value: float
    status: SettlementStatus
    operator_name: Optional[str] = None
    processed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    operation_type: str
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    operator_role: Optional[str] = None
    operator_name: Optional[str] = None
    result: str
    reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ExportRequest(BaseModel):
    start_date: date
    end_date: date
    export_type: str = "shortage"
    include_sensitive: bool = False
    idempotent_key: Optional[str] = None


class ImportRequest(BaseModel):
    file_path: str
    import_type: str = "shortage"
    idempotent_key: Optional[str] = None
