from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field


class TicketType(str, Enum):
    PAID = "售票"
    COMPLIMENTARY = "赠票"
    UNKNOWN = "未知"


class BookingStatus(str, Enum):
    PENDING = "待处理"
    NORMAL = "正常"
    MIXED_BATCH = "赠票售票混批待复核"
    NEEDS_CONTRACT = "待补合同页"
    CONFLICT = "冲突"
    RESOLVED = "已解决"
    ARCHIVED = "已归档"


class AuthReminderLevel(str, Enum):
    NONE = "无需提醒"
    INFO = "普通提醒"
    WARNING = "警告"
    CRITICAL = "紧急"


class Booking(BaseModel):
    id: str
    room_name: str
    date: str
    time_slot: str
    band_name: str
    contact: str
    ticket_type: TicketType = TicketType.UNKNOWN
    batch_id: Optional[str] = None
    status: BookingStatus = BookingStatus.PENDING
    contract_screenshot: Optional[str] = None
    contract_ticket_type: Optional[TicketType] = None
    auth_reminder: AuthReminderLevel = AuthReminderLevel.NONE
    notes: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class Batch(BaseModel):
    batch_id: str
    date: str
    ticket_types: List[TicketType] = Field(default_factory=list)
    bookings: List[str] = Field(default_factory=list)
    is_mixed: bool = False


class ProcessingStep(str, Enum):
    IMPORT = "导入接龙"
    DETECT_MIXED = "检测混批"
    REVIEW = "人工复核"
    ADD_CONTRACT = "补录合同页"
    UPDATE_AUTH = "更新授权提醒"
    RERUN = "重跑处理"
    RESOLVE = "标记解决"


class ProcessingRecord(BaseModel):
    step: ProcessingStep
    timestamp: datetime = Field(default_factory=datetime.now)
    booking_id: Optional[str] = None
    details: str
    operator: str = "系统"
    before_status: Optional[BookingStatus] = None
    after_status: Optional[BookingStatus] = None


class RunSession(BaseModel):
    session_id: str
    started_at: datetime = Field(default_factory=datetime.now)
    ended_at: Optional[datetime] = None
    command: str
    records: List[ProcessingRecord] = Field(default_factory=list)
    bookings_before: List[Booking] = Field(default_factory=list)
    bookings_after: List[Booking] = Field(default_factory=list)


class ProjectState(BaseModel):
    bookings: List[Booking] = Field(default_factory=list)
    batches: List[Batch] = Field(default_factory=list)
    sessions: List[RunSession] = Field(default_factory=list)
    current_session_id: Optional[str] = None
