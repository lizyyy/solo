from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Any, Dict
from app.models import EventStatus, EventType, OrderStatus, IssueType, UserRole


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class UserBase(BaseModel):
    username: str
    full_name: Optional[str] = None
    role: UserRole = UserRole.OPERATOR


class UserCreate(UserBase):
    password: str
    phone: Optional[str] = None


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class DeviceBase(BaseModel):
    device_code: str
    device_name: Optional[str] = None
    location: Optional[str] = None
    cabin_count: int = 10


class DeviceCreate(DeviceBase):
    pass


class DeviceResponse(DeviceBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class DeviceEventBase(BaseModel):
    event_id: str
    device_code: str
    event_type: EventType
    event_time: datetime
    cabin_number: Optional[int] = None
    battery_code: Optional[str] = None
    user_phone: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    raw_data: Optional[Any] = None


class DeviceEventCreate(DeviceEventBase):
    pass


class DeviceEventResponse(DeviceEventBase):
    id: int
    device_id: int
    status: EventStatus
    created_at: datetime
    
    class Config:
        from_attributes = True


class OrderBase(BaseModel):
    device_code: str
    event_id: Optional[str] = None
    issue_type: Optional[IssueType] = None
    issue_description: Optional[str] = None
    cabin_number: Optional[int] = None
    customer_phone: Optional[str] = None
    customer_name: Optional[str] = None


class OrderCreate(OrderBase):
    pass


class OrderResponse(OrderBase):
    id: int
    order_no: str
    status: OrderStatus
    created_by: Optional[int] = None
    received_by: Optional[int] = None
    attributed_by: Optional[int] = None
    dispatched_to: Optional[int] = None
    reviewed_by: Optional[int] = None
    received_at: Optional[datetime] = None
    attributed_at: Optional[datetime] = None
    dispatched_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class OrderReceiveRequest(BaseModel):
    order_ids: List[int]


class OrderAttributeRequest(BaseModel):
    order_id: int
    issue_type: IssueType
    issue_description: Optional[str] = None


class OrderDispatchRequest(BaseModel):
    order_ids: List[int]
    engineer_id: int


class OrderReviewRequest(BaseModel):
    order_id: int
    remark: Optional[str] = None
    close: bool = False


class BatchResult(BaseModel):
    success: List[int]
    failed: List[int]
    failed_details: List[Dict[str, Any]] = Field(default_factory=list)


class EventBatchImportRequest(BaseModel):
    events: List[DeviceEventCreate]


class OrderBatchCreateRequest(BaseModel):
    orders: List[OrderCreate]


class ExportRequest(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[List[OrderStatus]] = None
    issue_type: Optional[List[IssueType]] = None