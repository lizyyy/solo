from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional, List
from enum import Enum

class VisitType(str, Enum):
    DAILY_CARE = "daily_care"
    HEALTH_CHECK = "health_check"
    MEDICATION_ASSISTANCE = "medication_assistance"
    EMERGENCY_VISIT = "emergency_visit"
    PSYCHOLOGICAL_COUNSELING = "psychological_counseling"
    OTHER = "other"

class ExceptionType(str, Enum):
    ELDERLY_NOT_AT_HOME = "elderly_not_at_home"
    HEALTH_EMERGENCY = "health_emergency"
    MEDICATION_ISSUE = "medication_issue"
    LIVING_CONDITION_PROBLEM = "living_condition_problem"
    FAMILY_EMERGENCY = "family_emergency"
    SERVICE_INTERRUPTION = "service_interruption"
    OTHER = "other"

class ExceptionLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class ElderlyBase(BaseModel):
    name: str
    id_card: str
    gender: str
    birth_date: date
    address: str
    phone: Optional[str] = None
    family_contact_name: str
    family_contact_phone: str
    health_status: Optional[str] = None
    special_needs: Optional[str] = None

class ElderlyCreate(ElderlyBase):
    pass

class Elderly(ElderlyBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class VisitPlanBase(BaseModel):
    elderly_id: int
    plan_date: date
    plan_time: str
    visit_type: VisitType
    caregiver: str
    caregiver_phone: Optional[str] = None
    notes: Optional[str] = None

class VisitPlanCreate(VisitPlanBase):
    idempotency_key: str

class VisitPlanUpdate(BaseModel):
    plan_date: Optional[date] = None
    plan_time: Optional[str] = None
    visit_type: Optional[VisitType] = None
    caregiver: Optional[str] = None
    caregiver_phone: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class VisitPlan(VisitPlanBase):
    id: int
    status: str
    task_idempotency_key: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class VisitRecordBase(BaseModel):
    elderly_id: int
    plan_id: Optional[int] = None
    visit_date: date
    check_in_time: datetime
    latitude: float
    longitude: float
    location_accuracy: Optional[float] = None
    caregiver: str
    actual_visit_type: Optional[str] = None
    health_condition: Optional[str] = None
    services_provided: Optional[str] = None
    notes: Optional[str] = None

class VisitRecordCreate(VisitRecordBase):
    is_backdated: bool = False
    backdated_reason: Optional[str] = None

class VisitRecordCheckIn(BaseModel):
    elderly_id: int
    plan_id: Optional[int] = None
    latitude: float
    longitude: float
    location_accuracy: Optional[float] = None
    caregiver: str

class VisitRecordCheckOut(BaseModel):
    check_out_time: datetime
    actual_visit_type: Optional[str] = None
    health_condition: Optional[str] = None
    services_provided: Optional[str] = None
    notes: Optional[str] = None

class VisitRecord(VisitRecordBase):
    id: int
    check_out_time: Optional[datetime] = None
    is_backdated: bool
    backdated_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ExceptionReportBase(BaseModel):
    elderly_id: int
    plan_id: Optional[int] = None
    exception_type: ExceptionType
    exception_level: ExceptionLevel
    report_time: datetime
    reported_by: str
    description: str
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class ExceptionReportCreate(ExceptionReportBase):
    pass

class ExceptionReportResolve(BaseModel):
    resolution: str
    resolved_by: str

class ExceptionReport(ExceptionReportBase):
    id: int
    status: str
    resolved_time: Optional[datetime] = None
    resolution: Optional[str] = None
    resolved_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class NotificationBase(BaseModel):
    exception_id: int
    recipient_type: str
    recipient_name: str
    recipient_phone: str
    notification_type: str
    content: str

class NotificationCreate(NotificationBase):
    pass

class Notification(NotificationBase):
    id: int
    send_time: datetime
    delivery_status: str
    ack_time: Optional[datetime] = None
    ack_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class TaskMergeHistoryBase(BaseModel):
    plan_id: int
    merged_from_plan_ids: str
    merge_reason: str
    merged_by: str

class TaskMergeHistory(TaskMergeHistoryBase):
    id: int
    merge_time: datetime

    class Config:
        from_attributes = True

class OperationHistoryBase(BaseModel):
    plan_id: int
    record_id: Optional[int] = None
    record_type: Optional[str] = None
    operation_type: str
    operation_detail: str
    operator: str
    original_data: Optional[str] = None
    new_data: Optional[str] = None

class OperationHistory(OperationHistoryBase):
    id: int
    operation_time: datetime

    class Config:
        from_attributes = True

class DailyReport(BaseModel):
    report_date: date
    total_plans: int
    completed_visits: int
    pending_visits: int
    missed_visits: int
    total_exceptions: int
    pending_exceptions: int
    resolved_exceptions: int
    family_notifications_sent: int

class ElderlyVisitSummary(BaseModel):
    elderly_id: int
    elderly_name: str
    total_plans: int
    completed_visits: int
    missed_visits: int
    last_visit_date: Optional[date] = None
    total_exceptions: int
    unresolved_exceptions: int
