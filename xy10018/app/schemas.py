from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from .models import UserRole, ReissueStatus, OperationType

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

class UserBase(BaseModel):
    username: str
    email: str
    full_name: Optional[str] = None
    role: UserRole = UserRole.CS

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ReissueBase(BaseModel):
    order_no: str
    customer_name: str
    customer_phone: Optional[str] = None
    address: Optional[str] = None
    product_name: str
    product_sku: Optional[str] = None
    quantity: int = 1
    reason: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[int] = None

class ReissueCreate(ReissueBase):
    pass

class ReissueUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    address: Optional[str] = None
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    quantity: Optional[int] = None
    reason: Optional[str] = None
    description: Optional[str] = None
    tracking_number: Optional[str] = None
    shipping_company: Optional[str] = None
    shipping_cost: Optional[float] = None
    remarks: Optional[str] = None
    assigned_to: Optional[int] = None

class StatusChange(BaseModel):
    status: ReissueStatus
    remarks: Optional[str] = None

class ReissueResponse(ReissueBase):
    id: int
    status: ReissueStatus
    tracking_number: Optional[str] = None
    shipping_company: Optional[str] = None
    shipping_cost: Optional[float] = None
    remarks: Optional[str] = None
    version: int
    retry_count: int
    last_error: Optional[str] = None
    created_by: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class StatusHistoryResponse(BaseModel):
    id: int
    reissue_id: int
    from_status: Optional[ReissueStatus] = None
    to_status: ReissueStatus
    changed_by: int
    remarks: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ReissueHistoryResponse(BaseModel):
    id: int
    reissue_id: int
    version: int
    snapshot: Dict[str, Any]
    changed_by: int
    change_type: str
    created_at: datetime

    class Config:
        from_attributes = True

class OperationLogResponse(BaseModel):
    id: int
    user_id: int
    reissue_id: Optional[int] = None
    operation_type: OperationType
    detail: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class BatchOperation(BaseModel):
    ids: List[int]
    operation: str
    params: Optional[Dict[str, Any]] = None

class FailedTaskResponse(BaseModel):
    id: int
    task_name: str
    reissue_id: Optional[int] = None
    error_message: str
    retry_count: int
    max_retries: int
    next_retry_at: Optional[datetime] = None
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[Any]

    class Config:
        arbitrary_types_allowed = True
