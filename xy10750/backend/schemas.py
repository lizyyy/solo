from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class ChannelEnum(str, Enum):
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"
    WECHAT = "wechat"
    APP = "app"


class StatusEnum(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    PENDING = "pending"
    SUSPENDED = "suspended"


class ReceiptStatusEnum(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"
    CANCELLED = "cancelled"


class RetryStatusEnum(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    EXECUTED = "executed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class UserPreferenceCreate(BaseModel):
    user_id: str
    channel: ChannelEnum
    topics: List[str]
    dnd_start_time: Optional[str] = None
    dnd_end_time: Optional[str] = None
    dnd_enabled: bool = False
    request_id: str
    created_by: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = {}


class UserPreferenceUpdate(BaseModel):
    channel: Optional[ChannelEnum] = None
    topics: Optional[List[str]] = None
    dnd_start_time: Optional[str] = None
    dnd_end_time: Optional[str] = None
    dnd_enabled: Optional[bool] = None
    status: Optional[StatusEnum] = None
    change_reason: str
    updated_by: str
    request_id: str


class UserPreferenceResponse(BaseModel):
    id: int
    user_id: str
    request_id: str
    channel: str
    topics: List[str]
    dnd_start_time: Optional[str]
    dnd_end_time: Optional[str]
    dnd_enabled: bool
    status: str
    version: int
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str]
    updated_by: Optional[str]
    metadata: Dict[str, Any]

    class Config:
        from_attributes = True


class SendReceiptCreate(BaseModel):
    message_id: str
    preference_id: Optional[int] = None
    user_id: str
    request_id: str
    channel: str
    topic: str
    metadata: Optional[Dict[str, Any]] = {}


class SendReceiptUpdate(BaseModel):
    status: ReceiptStatusEnum
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = {}


class SendReceiptResponse(BaseModel):
    id: int
    preference_id: Optional[int]
    message_id: str
    request_id: str
    user_id: str
    channel: str
    topic: str
    status: str
    sent_at: Optional[datetime]
    delivered_at: Optional[datetime]
    read_at: Optional[datetime]
    failed_at: Optional[datetime]
    error_code: Optional[str]
    error_message: Optional[str]
    retry_count: int
    metadata: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True


class RetryRecordCreate(BaseModel):
    receipt_id: int
    preference_id: Optional[int] = None
    retry_number: int
    metadata: Optional[Dict[str, Any]] = {}


class RetryConfirm(BaseModel):
    confirmed_by: str
    metadata: Optional[Dict[str, Any]] = {}


class RetryRecordResponse(BaseModel):
    id: int
    preference_id: Optional[int]
    receipt_id: int
    retry_number: int
    status: str
    manual_confirmed: bool
    confirmed_by: Optional[str]
    confirmed_at: Optional[datetime]
    executed_at: Optional[datetime]
    result: Optional[str]
    error_message: Optional[str]
    metadata: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True


class VersionHistoryResponse(BaseModel):
    id: int
    preference_id: int
    user_id: str
    version: int
    channel: Optional[str]
    topics: Optional[List[str]]
    dnd_start_time: Optional[str]
    dnd_end_time: Optional[str]
    dnd_enabled: Optional[bool]
    status: Optional[str]
    change_reason: Optional[str]
    changed_by: Optional[str]
    snapshot: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True


class ExportRequest(BaseModel):
    export_type: str
    filters: Optional[Dict[str, Any]] = {}
    created_by: Optional[str] = None


class ExportResponse(BaseModel):
    export_id: str
    export_type: str
    status: str
    file_name: Optional[str]
    total_records: int
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class PageParams(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    data: List[Any]


class IdempotentResponse(BaseModel):
    request_id: str
    status: str
    result: Optional[Dict[str, Any]]
    error_message: Optional[str]
    created_at: datetime