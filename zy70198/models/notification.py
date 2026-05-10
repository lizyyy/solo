from datetime import date, datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class NotificationStatus(str, Enum):
    PENDING = 'pending'
    SENT = 'sent'
    ACKNOWLEDGED = 'acknowledged'
    FAILED = 'failed'


class DelayNotification(BaseModel):
    id: str = Field(..., description='通知ID')
    payment_plan_id: str = Field(..., description='关联的付款计划ID')
    
    original_payment_date: date = Field(..., description='原定付款日期')
    new_payment_date: date = Field(..., description='新的付款日期')
    
    delay_days: int = Field(..., description='延后天数')
    delay_reason: str = Field(..., description='延后原因')
    
    notify_to: str = Field(..., description='通知对象（采购/供应商联系人）')
    notify_channel: str = Field(default='email', description='通知渠道：email/sms/portal')
    
    status: NotificationStatus = Field(default=NotificationStatus.PENDING, description='通知状态')
    
    sent_at: Optional[datetime] = Field(default=None, description='发送时间')
    acknowledged_at: Optional[datetime] = Field(default=None, description='确认时间')
    
    created_at: datetime = Field(default_factory=datetime.now, description='创建时间')
    updated_at: datetime = Field(default_factory=datetime.now, description='更新时间')
    
    remark: Optional[str] = Field(default=None, description='备注')
    
    def mark_updated(self) -> None:
        self.updated_at = datetime.now()
