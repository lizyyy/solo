from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Any, Dict
from app.models import Role, TaskStatus, TaskPriority, ExceptionType, OperationType


class EscortBase(BaseModel):
    name: str
    phone: str
    employee_id: str


class EscortCreate(EscortBase):
    pass


class Escort(EscortBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PatientBase(BaseModel):
    name: str
    medical_record_no: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    bed_no: Optional[str] = None


class PatientCreate(PatientBase):
    pass


class Patient(PatientBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class TaskBase(BaseModel):
    request_id: str
    service_type: Optional[str] = None
    from_location: Optional[str] = None
    to_location: Optional[str] = None
    description: Optional[str] = None
    priority: TaskPriority = TaskPriority.NORMAL


class TaskCreate(TaskBase):
    patient_name: str
    patient_medical_record_no: Optional[str] = None
    patient_phone: Optional[str] = None
    patient_department: Optional[str] = None
    patient_bed_no: Optional[str] = None
    operator_role: str = Role.DISPATCHER
    operator_name: str = "System"


class Task(TaskBase):
    id: int
    patient_id: int
    assigned_escort_id: Optional[int] = None
    status: TaskStatus
    queue_position: Optional[int] = None
    created_at: datetime
    assigned_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    timeout_at: Optional[datetime] = None
    wait_duration: Optional[int] = None
    service_duration: Optional[int] = None
    total_duration: Optional[int] = None
    operator_role: Optional[str] = None
    operator_name: Optional[str] = None
    has_exception: bool = False
    exception_type: Optional[ExceptionType] = None
    exception_note: Optional[str] = None

    class Config:
        from_attributes = True


class TaskDetail(Task):
    patient: Optional[Patient] = None
    assigned_escort: Optional[Escort] = None


class TaskAssign(BaseModel):
    escort_id: int
    operator_role: str
    operator_name: str


class TaskAccept(BaseModel):
    operator_role: str
    operator_name: str


class TaskTransfer(BaseModel):
    new_escort_id: int
    operator_role: str
    operator_name: str
    note: Optional[str] = None


class TaskComplete(BaseModel):
    operator_role: str
    operator_name: str
    completion_note: Optional[str] = None


class TaskCancel(BaseModel):
    operator_role: str
    operator_name: str
    cancel_reason: Optional[str] = None


class TaskUpdatePriority(BaseModel):
    new_priority: TaskPriority
    operator_role: str
    operator_name: str
    note: Optional[str] = None


class AuditLogBase(BaseModel):
    task_id: int
    operation_type: OperationType
    operator_role: str
    operator_name: str
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    old_escort_id: Optional[int] = None
    new_escort_id: Optional[int] = None
    note: Optional[str] = None


class AuditLog(AuditLogBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class BatchOperation(BaseModel):
    task_ids: List[int]
    operator_role: str
    operator_name: str


class BatchAssign(BatchOperation):
    escort_id: int


class BatchComplete(BatchOperation):
    completion_note: Optional[str] = None


class BatchCancel(BatchOperation):
    cancel_reason: Optional[str] = None


class BatchUpdatePriority(BatchOperation):
    new_priority: TaskPriority
    note: Optional[str] = None


class BatchResult(BaseModel):
    total: int
    success_count: int
    failed_count: int
    success: List[Dict[str, Any]]
    failed: List[Dict[str, Any]]


class TaskSummary(BaseModel):
    total: int
    status: Dict[str, int]
    has_exception: int
    wait_times: Dict[str, float]


class EscortPerformance(BaseModel):
    escort_id: int
    escort_name: str
    total_tasks: int
    completed_tasks: int
    exception_tasks: int
    completion_rate: float
    avg_wait_minutes: float
    avg_service_minutes: float


class DailyTrend(BaseModel):
    date: str
    total_tasks: int
    completed_tasks: int
    exception_tasks: int
    avg_wait_minutes: float


class ExceptionSummary(BaseModel):
    total_exceptions: int
    by_type: Dict[str, int]


class QueueItem(BaseModel):
    task_id: int
    request_id: str
    priority: str
    queue_position: Optional[int] = None
    wait_minutes: int


class QueueSummary(BaseModel):
    pending_count: int
    urgent_count: int
    emergency_count: int
    avg_wait_minutes: float
    queue: List[QueueItem]


class ExportFile(BaseModel):
    filename: str
    filepath: str


class TaskFilterParams(BaseModel):
    status: Optional[TaskStatus] = None
    escort_id: Optional[int] = None
    priority: Optional[TaskPriority] = None
    has_exception: Optional[bool] = None
    exception_type: Optional[ExceptionType] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    skip: int = 0
    limit: int = 100
