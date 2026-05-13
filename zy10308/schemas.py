from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from models import MessageStatus

class MessageCreate(BaseModel):
    message_id: str = Field(..., max_length=100, description="全局唯一消息ID")
    source: str = Field(..., max_length=100, description="消息来源系统")
    business_key: str = Field(..., max_length=200, description="业务主键，用于幂等判定")
    deduplication_window: int = Field(default=86400, description="去重窗口秒数")
    payload: Optional[str] = Field(None, description="消息负载")
    max_retries: int = Field(default=3, description="最大重试次数")

class MessageResponse(BaseModel):
    id: int
    message_id: str
    source: str
    business_key: str
    status: MessageStatus
    deduplication_window: int
    retry_count: int
    max_retries: int
    failure_reason: Optional[str]
    created_at: datetime
    updated_at: datetime
    processed_at: Optional[datetime]

    class Config:
        orm_mode = True
        from_attributes = True

class StatusUpdate(BaseModel):
    status: MessageStatus
    reason: Optional[str] = Field(None, max_length=500)
    operator: Optional[str] = Field(None, max_length=100)

class ReceiptCreate(BaseModel):
    receipt_type: str = Field(..., max_length=50)
    receipt_data: str

class ReceiptResponse(BaseModel):
    id: int
    message_id: int
    receipt_type: str
    receipt_data: str
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

class StatusHistoryResponse(BaseModel):
    id: int
    message_id: int
    from_status: Optional[MessageStatus]
    to_status: MessageStatus
    reason: Optional[str]
    operator: Optional[str]
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

class MessageDetailResponse(MessageResponse):
    receipts: List[ReceiptResponse]
    status_history: List[StatusHistoryResponse]

class MessageQuery(BaseModel):
    source: Optional[str] = None
    business_key: Optional[str] = None
    status: Optional[MessageStatus] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
