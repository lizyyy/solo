from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class RedPacketStatus(str, Enum):
    DRAFT = "draft"
    PENDING_PAYMENT = "pending_payment"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FROZEN = "frozen"


class PacketStatus(str, Enum):
    PENDING = "pending"
    LOCKED = "locked"
    CLAIMED = "claimed"
    EXPIRED = "expired"
    FROZEN = "frozen"


class TransactionType(str, Enum):
    RECHARGE = "recharge"
    CREATE_PACKET = "create_packet"
    CLAIM_PACKET = "claim_packet"
    REFUND = "refund"
    FROZEN = "frozen"
    UNFROZEN = "unfrozen"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"


class RiskAction(str, Enum):
    FREEZE = "freeze"
    UNFREEZE = "unfreeze"
    WARN = "warn"


class CreateRedPacketActivityRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    total_amount: float = Field(..., gt=0)
    total_count: int = Field(..., gt=0)
    merchant_id: str = Field(..., min_length=1, max_length=50)
    merchant_name: Optional[str] = Field(None, max_length=200)
    rule_type: str = Field(default="random", pattern="^(random|fixed)$")
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class RedPacketActivityResponse(BaseModel):
    activity_id: str
    name: str
    description: Optional[str]
    total_amount: float
    total_count: int
    remaining_amount: float
    remaining_count: int
    status: RedPacketStatus
    rule_type: str
    merchant_id: str
    merchant_name: Optional[str]
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LockBudgetRequest(BaseModel):
    activity_id: str
    merchant_id: str


class ClaimPacketRequest(BaseModel):
    activity_id: str
    user_id: str
    user_name: Optional[str] = None
    request_id: str = Field(..., min_length=1, max_length=100)


class ClaimPacketResponse(BaseModel):
    request_id: str
    status: str
    is_success: bool
    amount: Optional[float] = None
    packet_id: Optional[str] = None
    error_message: Optional[str] = None


class PaymentCallbackRequest(BaseModel):
    payment_id: str
    status: str
    external_order_id: Optional[str] = None
    callback_data: Optional[str] = None


class RiskActionRequest(BaseModel):
    activity_id: str
    merchant_id: str
    action: RiskAction
    reason: str
    packet_id: Optional[str] = None
    user_id: Optional[str] = None


class AuditExportRequest(BaseModel):
    merchant_id: str
    start_time: datetime
    end_time: datetime
    action: Optional[str] = None
    module: Optional[str] = None


class ListActivitiesRequest(BaseModel):
    merchant_id: str
    status: Optional[str] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class PaginatedResponse(BaseModel):
    items: List
    total: int
    page: int
    page_size: int
    total_pages: int


class ErrorResponse(BaseModel):
    error_code: str
    error_message: str
    details: Optional[dict] = None
