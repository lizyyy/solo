from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator
import uuid


class SLAStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    WAITING_CUSTOMER = "waiting_customer"
    COMPLETED = "completed"
    BREACHED = "breached"


class PauseType(str, Enum):
    HOLIDAY = "holiday"
    CUSTOMER_PENDING = "customer_pending"
    MANUAL_PAUSE = "manual_pause"
    SYSTEM_MAINTENANCE = "system_maintenance"


class TicketPriority(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Holiday(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    start_time: datetime
    end_time: datetime
    timezone: str = "Asia/Shanghai"
    region: str = "default"
    description: Optional[str] = None

    @field_validator('end_time')
    def end_after_start(cls, v, values):
        if 'start_time' in values.data and v <= values.data['start_time']:
            raise ValueError('end_time must be after start_time')
        return v


class SLARule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    priority: TicketPriority
    response_time_hours: float
    resolution_time_hours: float
    working_hours_start: int = Field(default=9, ge=0, le=23)
    working_hours_end: int = Field(default=18, ge=1, le=24)
    consider_holidays: bool = True
    consider_weekends: bool = True
    timezone: str = "Asia/Shanghai"
    description: Optional[str] = None

    @field_validator('working_hours_end')
    def hours_valid(cls, v, values):
        if 'working_hours_start' in values.data and v <= values.data['working_hours_start']:
            raise ValueError('working_hours_end must be after working_hours_start')
        return v


class PauseRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ticket_id: str
    pause_type: PauseType
    start_time: datetime
    end_time: Optional[datetime] = None
    reason: str
    operator: Optional[str] = None
    is_active: bool = True
    idempotency_key: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class CustomerReply(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ticket_id: str
    reply_time: datetime
    content: str
    requires_followup: bool = False
    followup_deadline: Optional[datetime] = None
    auto_resume_sla: bool = True


class Ticket(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    priority: TicketPriority
    status: SLAStatus = SLAStatus.PENDING
    sla_rule_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now())
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    paused_at: Optional[datetime] = None
    customer_id: Optional[str] = None
    assignee: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TimeDetail(BaseModel):
    total_seconds: float
    working_seconds: float
    paused_seconds: float
    holiday_seconds: float
    weekend_seconds: float
    customer_pending_seconds: float
    remaining_seconds: float
    effective_elapsed_seconds: float


class TimeSegment(BaseModel):
    segment_type: str
    start_time: datetime
    end_time: datetime
    duration_seconds: float
    description: str


class SLABreach(BaseModel):
    breach_type: str
    threshold_seconds: float
    actual_seconds: float
    exceeded_seconds: float
    breach_time: datetime
    explanation: str
    contributing_factors: List[str]


class SLAReport(BaseModel):
    ticket_id: str
    ticket_title: str
    sla_rule_name: str
    current_status: SLAStatus
    time_details: TimeDetail
    time_segments: List[TimeSegment]
    breaches: List[SLABreach]
    pause_history: List[PauseRecord]
    customer_replies: List[CustomerReply]
    is_breached: bool
    summary: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now())


class TimeCalculationRequest(BaseModel):
    ticket_id: str
    target_time: Optional[datetime] = None
    include_segments: bool = True


class PauseRequest(BaseModel):
    ticket_id: str
    pause_type: PauseType
    reason: str
    start_time: Optional[datetime] = None
    operator: Optional[str] = None
    idempotency_key: Optional[str] = None


class ResumeRequest(BaseModel):
    ticket_id: str
    resume_time: Optional[datetime] = None
    operator: Optional[str] = None
    reason: Optional[str] = None


class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None
    errors: List[str] = Field(default_factory=list)
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
