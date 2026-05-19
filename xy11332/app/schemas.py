from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from .models import PatientPriority, TaskStatus, AuditAction


class EscortBase(BaseModel):
    name: str
    employee_id: str
    phone: Optional[str] = None
    max_tasks: int = 3


class EscortCreate(EscortBase):
    pass


class Escort(EscortBase):
    id: int
    is_active: bool
    current_task_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class PatientBase(BaseModel):
    name: str
    medical_record_no: str
    age: Optional[int] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None


class PatientCreate(PatientBase):
    pass


class Patient(PatientBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class TaskBase(BaseModel):
    patient_id: int
    priority: PatientPriority = PatientPriority.NORMAL
    examination_type: str
    from_location: Optional[str] = None
    to_location: Optional[str] = None
    estimated_duration: int = 30
    timeout_minutes: int = 30


class TaskCreate(TaskBase):
    pass


class TaskAssign(BaseModel):
    escort_id: int


class TaskTransfer(BaseModel):
    new_escort_id: int
    reason: str


class TaskCancel(BaseModel):
    reason: str


class TaskUpdateStatus(BaseModel):
    status: TaskStatus


class Task(TaskBase):
    id: int
    task_no: str
    status: TaskStatus
    escort_id: Optional[int] = None
    wait_time: int
    reason: Optional[str] = None
    created_at: datetime
    assigned_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TaskDetail(Task):
    patient: Patient
    escort: Optional[Escort] = None


class AuditLogBase(BaseModel):
    task_id: int
    action: AuditAction
    operator: Optional[str] = None
    reason: Optional[str] = None


class AuditLog(AuditLogBase):
    id: int
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    old_escort_id: Optional[int] = None
    new_escort_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BatchTaskCreate(BaseModel):
    tasks: List[TaskCreate]


class BatchTaskAssign(BaseModel):
    task_ids: List[int]
    escort_id: int


class BatchResultItem(BaseModel):
    task_no: str
    success: bool
    error_message: Optional[str] = None


class BatchOperationResult(BaseModel):
    batch_id: str
    total_count: int
    success_count: int
    failed_count: int
    results: List[BatchResultItem]


class RuleResult(BaseModel):
    passed: bool
    rule_name: str
    message: str
    suggestion: Optional[str] = None