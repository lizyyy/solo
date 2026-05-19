from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

from app.models import IncidentStatus, SubscriberStatus


class IncidentBase(BaseModel):
    id: str = Field(..., description="事故编号")
    title: str = Field(..., description="事故标题")
    description: Optional[str] = Field(None, description="事故描述")


class IncidentCreate(IncidentBase):
    pass


class IncidentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    review_summary: Optional[str] = None


class IncidentResponse(IncidentBase):
    current_status: IncidentStatus
    created_at: datetime
    updated_at: Optional[datetime]
    is_active: bool
    review_summary: Optional[str]

    class Config:
        from_attributes = True


class IncidentDetailResponse(IncidentResponse):
    announcements_count: int
    subscribers_count: int
    confirmations_count: int


class AnnouncementBase(BaseModel):
    service_status: str = Field(..., description="服务状态描述")
    content: str = Field(..., description="公告内容")
    created_by: Optional[str] = Field(None, description="创建人")


class AnnouncementCreate(AnnouncementBase):
    incident_id: str


class AnnouncementResponse(AnnouncementBase):
    id: int
    incident_id: str
    version: int
    created_at: datetime

    class Config:
        from_attributes = True


class SubscriberBase(BaseModel):
    name: str = Field(..., description="订阅方名称")
    email: Optional[str] = Field(None, description="订阅方邮箱")


class SubscriberCreate(SubscriberBase):
    incident_id: str


class SubscriberResponse(SubscriberBase):
    id: int
    incident_id: str
    status: SubscriberStatus
    subscribed_at: datetime

    class Config:
        from_attributes = True


class ConfirmationBase(BaseModel):
    notes: Optional[str] = Field(None, description="确认备注")


class ConfirmationCreate(ConfirmationBase):
    incident_id: str
    announcement_id: int
    subscriber_id: int


class ConfirmationResponse(ConfirmationBase):
    id: int
    incident_id: str
    announcement_id: int
    subscriber_id: int
    confirmed_at: datetime

    class Config:
        from_attributes = True


class CorrectionLogBase(BaseModel):
    original_input: str = Field(..., description="原始输入")
    processed_by: str = Field(..., description="处理人")
    conclusion: str = Field(..., description="处理结论")
    correction_type: Optional[str] = Field(None, description="修正类型")


class CorrectionLogCreate(CorrectionLogBase):
    incident_id: str


class CorrectionLogResponse(CorrectionLogBase):
    id: int
    incident_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class StatusUpdate(BaseModel):
    status: IncidentStatus = Field(..., description="目标状态")


class IncidentExport(BaseModel):
    incident_id: str
    title: str
    description: Optional[str]
    current_status: str
    review_summary: Optional[str]
    announcements: List[dict]
    subscribers: List[dict]
    confirmations: List[dict]
    correction_logs: List[dict]
    exported_at: datetime
