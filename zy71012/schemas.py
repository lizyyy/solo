from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from models import AlarmStatus, AlarmSource


class CallRecordBase(BaseModel):
    call_type: str
    caller: str
    caller_phone: Optional[str] = None
    call_time: datetime
    duration: Optional[int] = None
    content: str
    operator: str


class CallRecordCreate(CallRecordBase):
    pass


class CallRecord(CallRecordBase):
    id: int
    alarm_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class StatusHistoryBase(BaseModel):
    from_status: Optional[str] = None
    to_status: str
    operator: str
    remark: Optional[str] = None


class StatusHistoryCreate(StatusHistoryBase):
    pass


class StatusHistory(StatusHistoryBase):
    id: int
    alarm_id: int
    change_time: datetime

    class Config:
        from_attributes = True


class AuditLogBase(BaseModel):
    field_name: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    operator: str
    change_reason: Optional[str] = None


class AuditLogCreate(AuditLogBase):
    pass


class AuditLog(AuditLogBase):
    id: int
    alarm_id: int
    change_time: datetime

    class Config:
        from_attributes = True


class ElevatorAlarmBase(BaseModel):
    elevator_no: str
    alarm_time: datetime
    passenger_count: int = 0
    source: str
    location: Optional[str] = None
    description: Optional[str] = None
    created_by: str


class ElevatorAlarmCreate(ElevatorAlarmBase):
    maintenance_person: Optional[str] = None
    maintenance_phone: Optional[str] = None


class ElevatorAlarmUpdate(BaseModel):
    elevator_no: Optional[str] = None
    alarm_time: Optional[datetime] = None
    passenger_count: Optional[int] = None
    source: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    maintenance_person: Optional[str] = None
    maintenance_phone: Optional[str] = None
    dispatched_time: Optional[datetime] = None
    arrived_time: Optional[datetime] = None
    resolved_time: Optional[datetime] = None
    resolution: Optional[str] = None


class ElevatorAlarm(ElevatorAlarmBase):
    id: int
    alarm_no: str
    status: str
    is_timeout: bool
    timeout_reason: Optional[str] = None
    maintenance_person: Optional[str] = None
    maintenance_phone: Optional[str] = None
    dispatched_time: Optional[datetime] = None
    arrived_time: Optional[datetime] = None
    resolved_time: Optional[datetime] = None
    resolution: Optional[str] = None
    parent_id: Optional[int] = None
    merge_count: int
    reviewer: Optional[str] = None
    review_comment: Optional[str] = None
    review_time: Optional[datetime] = None
    previous_rejection: Optional[dict] = None
    resubmit_count: int
    created_at: datetime
    updated_at: datetime

    call_records: List[CallRecord] = []
    status_histories: List[StatusHistory] = []
    audit_logs: List[AuditLog] = []

    class Config:
        from_attributes = True


class ElevatorAlarmList(BaseModel):
    id: int
    alarm_no: str
    elevator_no: str
    alarm_time: datetime
    passenger_count: int
    source: str
    status: str
    is_timeout: bool
    maintenance_person: Optional[str] = None
    arrived_time: Optional[datetime] = None
    resolved_time: Optional[datetime] = None
    merge_count: int
    resubmit_count: int
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[ElevatorAlarmList]


class StatusTransition(BaseModel):
    new_status: str
    operator: str
    remark: Optional[str] = None


class DispatchMaintenance(BaseModel):
    maintenance_person: str
    maintenance_phone: str
    operator: str
    remark: Optional[str] = None


class ArriveOnSite(BaseModel):
    operator: str
    remark: Optional[str] = None


class ResolveAlarm(BaseModel):
    resolution: str
    operator: str
    remark: Optional[str] = None


class ReviewAlarm(BaseModel):
    is_approved: bool
    reviewer: str
    comment: Optional[str] = None


class ResubmitAlarm(BaseModel):
    resolution: Optional[str] = None
    operator: str
    remark: Optional[str] = None


class MergeAlarm(BaseModel):
    target_alarm_id: int
    operator: str
    remark: Optional[str] = None
