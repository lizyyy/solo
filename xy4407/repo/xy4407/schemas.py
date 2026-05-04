from datetime import datetime, date, time
from typing import Optional, List
from pydantic import BaseModel, Field
from models import (
    AuditoriumStatus, KDMSource, ScheduleStatus, 
    EventType, EventPriority, EventStatus
)


class AuditoriumBase(BaseModel):
    name: str = Field(..., description="影厅名称", example="1号厅")
    server_id: str = Field(..., description="服务器唯一标识", example="SVR-001")
    serial_number: Optional[str] = Field(None, description="设备序列号", example="SN2024001")
    location: Optional[str] = Field(None, description="位置描述", example="一楼西侧")
    status: AuditoriumStatus = Field(default=AuditoriumStatus.ACTIVE, description="影厅状态")


class AuditoriumCreate(AuditoriumBase):
    pass


class AuditoriumUpdate(BaseModel):
    name: Optional[str] = None
    server_id: Optional[str] = None
    serial_number: Optional[str] = None
    location: Optional[str] = None
    status: Optional[AuditoriumStatus] = None


class AuditoriumResponse(AuditoriumBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FilmBase(BaseModel):
    title: str = Field(..., description="影片标题", example="星际穿越")
    cpl_id: str = Field(..., description="CPL唯一标识", example="CPL-2024-001")
    duration: int = Field(..., description="片长（分钟）", example=169)
    language: Optional[str] = Field(None, description="语言版本", example="英语/中文字幕")
    version: Optional[str] = Field(None, description="版本", example="2D")


class FilmCreate(FilmBase):
    pass


class FilmUpdate(BaseModel):
    title: Optional[str] = None
    cpl_id: Optional[str] = None
    duration: Optional[int] = None
    language: Optional[str] = None
    version: Optional[str] = None


class FilmResponse(FilmBase):
    id: int
    imported_at: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class KDMBase(BaseModel):
    film_id: int = Field(..., description="关联的影片ID", example=1)
    auditorium_id: Optional[int] = Field(None, description="关联的影厅ID（空表示通用）", example=1)
    valid_from: datetime = Field(..., description="密钥生效时间")
    valid_to: datetime = Field(..., description="密钥过期时间")
    source: KDMSource = Field(default=KDMSource.MANUAL, description="密钥来源")
    notes: Optional[str] = Field(None, description="备注")


class KDMCreate(KDMBase):
    pass


class KDMUpdate(BaseModel):
    film_id: Optional[int] = None
    auditorium_id: Optional[int] = None
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None
    source: Optional[KDMSource] = None
    notes: Optional[str] = None


class KDMResponse(KDMBase):
    id: int
    cpl_id: str
    imported_at: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ScheduleBase(BaseModel):
    film_id: int = Field(..., description="影片ID", example=1)
    auditorium_id: int = Field(..., description="影厅ID", example=1)
    show_date: date = Field(..., description="放映日期")
    start_time: time = Field(..., description="开始时间")
    end_time: time = Field(..., description="结束时间")
    status: ScheduleStatus = Field(default=ScheduleStatus.SCHEDULED, description="排片状态")
    notes: Optional[str] = Field(None, description="备注")


class ScheduleCreate(ScheduleBase):
    pass


class ScheduleUpdate(BaseModel):
    film_id: Optional[int] = None
    auditorium_id: Optional[int] = None
    show_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    status: Optional[ScheduleStatus] = None
    notes: Optional[str] = None


class ScheduleReassign(BaseModel):
    new_auditorium_id: int = Field(..., description="新的影厅ID")
    notes: Optional[str] = Field(None, description="改派原因")


class ScheduleResponse(ScheduleBase):
    id: int
    original_auditorium_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EventBase(BaseModel):
    event_type: EventType = Field(..., description="事件类型")
    priority: EventPriority = Field(default=EventPriority.MEDIUM, description="事件优先级")
    title: str = Field(..., description="事件标题", example="密钥即将过期")
    description: str = Field(..., description="事件详细描述")
    
    film_id: Optional[int] = Field(None, description="关联的影片ID")
    auditorium_id: Optional[int] = Field(None, description="关联的影厅ID")
    schedule_id: Optional[int] = Field(None, description="关联的排片ID")
    kdm_id: Optional[int] = Field(None, description="关联的KDM ID")


class EventCreate(EventBase):
    pass


class EventAcknowledge(BaseModel):
    acknowledged_by: str = Field(..., description="确认人", example="张值班")


class EventResolve(BaseModel):
    resolved_by: str = Field(..., description="处理人", example="李技术")
    resolution_notes: str = Field(..., description="处理说明", example="已导入新的KDM密钥")


class EventResponse(EventBase):
    id: int
    status: EventStatus
    detected_at: datetime
    
    acknowledged_by: Optional[str]
    acknowledged_at: Optional[datetime]
    resolved_by: Optional[str]
    resolved_at: Optional[datetime]
    resolution_notes: Optional[str]
    
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BatchUploadRequest(BaseModel):
    auditoriums: List[AuditoriumCreate] = Field(default_factory=list, description="影厅列表")
    films: List[FilmCreate] = Field(default_factory=list, description="影片列表")
    kdms: List[KDMCreate] = Field(default_factory=list, description="KDM密钥列表")
    schedules: List[ScheduleCreate] = Field(default_factory=list, description="排片列表")


class BatchUploadResponse(BaseModel):
    auditoriums_created: int = 0
    films_created: int = 0
    kdms_created: int = 0
    schedules_created: int = 0
    events_detected: int = 0


class RiskSummaryItem(BaseModel):
    event_type: EventType
    count: int
    priority: EventPriority


class DailyRiskSummary(BaseModel):
    summary_date: date
    total_events: int
    pending_events: int
    acknowledged_events: int
    resolved_events: int
    
    by_priority: dict[EventPriority, int]
    by_type: List[RiskSummaryItem]
    
    critical_schedules: List[ScheduleResponse] = Field(default_factory=list)
    
    generated_at: datetime


class RiskDetectionResult(BaseModel):
    schedule_id: int
    film_title: str
    auditorium_name: str
    show_time: datetime
    risks: List[str]
    severity: EventPriority
