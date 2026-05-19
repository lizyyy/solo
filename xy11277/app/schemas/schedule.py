from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import date, datetime

from app.schemas.common import IdempotentRequest


class ForkliftBase(BaseModel):
    name: str
    battery_level: float = 100.0


class ForkliftCreate(ForkliftBase):
    pass


class ForkliftResponse(ForkliftBase):
    id: str
    status: str
    current_driver: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


class ChargingStationBase(BaseModel):
    name: str
    power: float = 100.0


class ChargingStationCreate(ChargingStationBase):
    pass


class ChargingStationResponse(ChargingStationBase):
    id: str
    status: str
    current_forklift: Optional[str] = None
    charging_start_time: Optional[datetime] = None
    is_active: bool

    class Config:
        from_attributes = True


class DriverBase(BaseModel):
    name: str
    employee_id: str
    shift_type: str = "night"


class DriverCreate(DriverBase):
    phone: str
    id_card: str


class DriverResponse(DriverBase):
    id: str
    phone: str
    status: str
    is_active: bool

    class Config:
        from_attributes = True


class TaskBase(BaseModel):
    name: str
    description: str = ""
    priority: str = "normal"
    estimated_duration: int = 60


class TaskCreate(TaskBase, IdempotentRequest):
    pass


class TaskBatchCreate(BaseModel):
    tasks: List[TaskCreate]


class TaskResponse(TaskBase):
    id: str
    status: str
    assigned_to: Optional[str] = None
    schedule_id: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ScheduleBase(BaseModel):
    schedule_date: date
    shift: str = "night"
    driver_id: str
    forklift_id: str


class ScheduleCreate(ScheduleBase, IdempotentRequest):
    task_ids: List[str] = Field(default_factory=list)


class ScheduleBatchCreate(BaseModel):
    schedules: List[ScheduleCreate]


class ScheduleResponse(ScheduleBase):
    id: str
    task_ids: List[str] = Field(default_factory=list)
    status: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LockResource(BaseModel):
    resource_type: str
    resource_id: str
    reason: str = ""
    expire_seconds: Optional[int] = None


class UnlockResource(BaseModel):
    resource_type: str
    resource_id: str


class LockResponse(BaseModel):
    id: str
    resource_type: str
    resource_id: str
    locked_by: str
    locked_at: datetime
    expires_at: Optional[datetime] = None
    reason: str
    is_active: bool


class ExceptionBase(BaseModel):
    exception_type: str
    description: str
    severity: str = "medium"


class ExceptionCreate(ExceptionBase):
    schedule_id: Optional[str] = None
    task_id: Optional[str] = None
    forklift_id: Optional[str] = None
    driver_id: Optional[str] = None


class ExceptionResolve(BaseModel):
    resolution: str


class ExceptionResponse(ExceptionBase):
    id: str
    schedule_id: Optional[str] = None
    task_id: Optional[str] = None
    forklift_id: Optional[str] = None
    driver_id: Optional[str] = None
    status: str
    reported_by: str
    reported_at: datetime
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    resolution: Optional[str] = None


class DailyReportRequest(BaseModel):
    report_date: date
    shift: str = "night"


class DailyReportResponse(BaseModel):
    id: str
    report_date: date
    shift: str
    total_tasks: int
    completed_tasks: int
    total_drivers: int
    active_drivers: int
    total_forklifts: int
    active_forklifts: int
    total_exceptions: int
    resolved_exceptions: int
    charging_stations_used: int
    generated_at: datetime
    details: dict

    class Config:
        from_attributes = True
