from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ReconciliationStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    REVIEWING = "reviewing"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"


class DiscrepancyType(str, Enum):
    OVERSTOCK = "overstock"
    UNDERSTOCK = "understock"
    EXPIRING_SOON = "expiring_soon"
    SKU_ALIAS = "sku_alias"
    OVER_REPLENISH = "over_replenish"
    UNDER_REPLENISH = "under_replenish"
    UNKNOWN = "unknown"


class ReviewAction(str, Enum):
    APPROVE = "approve"
    REJECT = "reject"
    REVISE = "revise"
    REQUEST_MORE_INFO = "request_more_info"


class AuditLog(BaseModel):
    id: str
    reconciliation_id: str
    action: str
    operator: str
    timestamp: datetime = Field(default_factory=datetime.now)
    details: Dict[str, Any]
    ip_address: Optional[str] = None


class SKUMapItem(BaseModel):
    sku: str
    aliases: List[str] = []
    category: Optional[str] = None
    unit: str = "个"


class PageParams(BaseModel):
    page: int = 1
    page_size: int = 20


class ApiResponse(BaseModel):
    code: int = 200
    message: str = "success"
    data: Optional[Any] = None
    total: Optional[int] = None
