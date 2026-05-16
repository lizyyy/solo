from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class SubscriberBase(BaseModel):
    name: str = Field(..., max_length=100)
    email: str = Field(..., max_length=100)
    description: Optional[str] = None


class SubscriberCreate(SubscriberBase):
    pass


class Subscriber(SubscriberBase):
    id: int
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class ApiPathBase(BaseModel):
    path: str = Field(..., max_length=500)
    method: str = Field(..., max_length=20)
    service: Optional[str] = None
    description: Optional[str] = None


class ApiPathCreate(ApiPathBase):
    pass


class ApiPath(ApiPathBase):
    id: int
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class ChangeTypeBase(BaseModel):
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=100)
    severity: str = "medium"
    description: Optional[str] = None


class ChangeTypeCreate(ChangeTypeBase):
    pass


class ChangeType(ChangeTypeBase):
    id: int

    class Config:
        from_attributes = True


class SubscriptionBase(BaseModel):
    subscriber_id: int
    api_path_id: int
    change_type_id: int


class SubscriptionCreate(SubscriptionBase):
    pass


class Subscription(SubscriptionBase):
    id: int
    created_at: datetime
    is_active: bool
    subscriber: Subscriber
    api_path: ApiPath
    change_type: ChangeType

    class Config:
        from_attributes = True


class ApiChangeBase(BaseModel):
    api_path_id: int
    change_type_id: int
    title: str = Field(..., max_length=200)
    description: Optional[str] = None
    change_date: datetime
    effective_date: Optional[datetime] = None
    raw_input: Optional[str] = None


class ApiChangeCreate(ApiChangeBase):
    pass


class ApiChange(ApiChangeBase):
    id: int
    created_at: datetime
    processing_result: Optional[str] = None
    is_processed: bool
    need_manual_correction: bool
    correction_note: Optional[str] = None

    class Config:
        from_attributes = True


class NotificationBatchBase(BaseModel):
    batch_number: str = Field(..., max_length=50)
    api_change_id: int


class NotificationBatchCreate(NotificationBatchBase):
    pass


class NotificationBatch(NotificationBatchBase):
    id: int
    created_at: datetime
    status: str
    retry_count: int
    last_retry_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NotificationBase(BaseModel):
    batch_id: int
    subscription_id: int
    subscriber_id: int
    api_change_id: int
    confirm_deadline: Optional[datetime] = None


class NotificationCreate(NotificationBase):
    pass


class NotificationConfirm(BaseModel):
    confirmation_note: Optional[str] = None


class Notification(NotificationBase):
    id: int
    created_at: datetime
    status: str
    confirmed_at: Optional[datetime] = None
    confirmation_note: Optional[str] = None
    is_duplicate: bool

    class Config:
        from_attributes = True


class SubscriptionReportItem(BaseModel):
    subscriber_name: str
    subscriber_email: str
    api_path: str
    api_method: str
    change_type: str
    change_title: str
    notification_status: str
    confirmed_at: Optional[datetime] = None
    confirm_deadline: Optional[datetime] = None


class SubscriptionReport(BaseModel):
    generated_at: datetime
    total_items: int
    pending_count: int
    confirmed_count: int
    expired_count: int
    items: List[SubscriptionReportItem]


class ErrorLog(BaseModel):
    timestamp: datetime
    error_type: str
    message: str
    raw_input: Optional[str] = None
    processing_result: Optional[str] = None
