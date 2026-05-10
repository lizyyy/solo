"""Pydantic 数据传输模型"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from app.models import TaskStatus, RetryRequestStatus, ExceptionType


class BatchJobBase(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    retry_window_hours: int = 24
    max_retries: int = 3
    is_active: bool = True


class BatchJobCreate(BatchJobBase):
    pass


class BatchJobResponse(BatchJobBase):
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TaskDependencyCreate(BaseModel):
    job_id: str
    source_task: str
    target_task: str
    is_soft_dependency: bool = False


class TaskDependencyResponse(TaskDependencyCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class TaskInstanceBase(BaseModel):
    id: str
    job_id: str
    task_name: str
    business_date: str
    max_retries: int = 3
    input_data: Optional[Dict[str, Any]] = None
    reentrancy_key: Optional[str] = None


class TaskInstanceCreate(TaskInstanceBase):
    pass


class TaskInstanceResponse(TaskInstanceBase):
    status: str
    retry_count: int
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    execution_duration_ms: Optional[int] = None
    output_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    is_locked: bool
    lock_acquired_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SkipRules(BaseModel):
    skip_if_predecessor_failed: bool = False
    skip_if_already_succeeded: bool = True
    skip_if_retry_count_exceeded: bool = True
    custom_conditions: Optional[Dict[str, Any]] = None


class RetryRequestCreate(BaseModel):
    task_instance_id: str
    requester: str
    reason: str
    retry_type: str = "single"
    target_retry_count: int = 1
    skip_rules: Optional[SkipRules] = None


class RetryRequestResponse(BaseModel):
    id: str
    task_instance_id: str
    requester: str
    reason: str
    retry_type: str
    target_retry_count: int
    skip_rules: Optional[Dict[str, Any]] = None
    window_start: Optional[datetime] = None
    window_end: Optional[datetime] = None
    is_within_window: Optional[bool] = None
    status: str
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RetryRequestApprove(BaseModel):
    approved_by: str
    notes: Optional[str] = None


class RetryRequestReject(BaseModel):
    rejected_by: str
    reason: str


class ExecutionReportResponse(BaseModel):
    id: str
    task_instance_id: str
    retry_request_id: Optional[str] = None
    execution_sequence: int
    status: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    skip_reason: Optional[str] = None
    is_skipped: bool
    input_snapshot: Optional[Dict[str, Any]] = None
    output_snapshot: Optional[Dict[str, Any]] = None
    error_details: Optional[Dict[str, Any]] = None
    affected_final_result: bool
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ExceptionRecordCreate(BaseModel):
    exception_type: str
    severity: str = "error"
    title: str
    details: str
    context: Optional[Dict[str, Any]] = None
    task_instance_id: Optional[str] = None
    retry_request_id: Optional[str] = None


class ExceptionRecordResponse(BaseModel):
    id: str
    exception_type: str
    severity: str
    task_instance_id: Optional[str] = None
    retry_request_id: Optional[str] = None
    title: str
    details: str
    context: Optional[Dict[str, Any]] = None
    is_resolved: bool
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DependencyCheckResult(BaseModel):
    task_name: str
    is_ready: bool
    pending_dependencies: List[str] = []
    failed_dependencies: List[str] = []
    skipped_dependencies: List[str] = []


class WindowCheckResult(BaseModel):
    is_within_window: bool
    window_start: datetime
    window_end: datetime
    current_time: datetime
    reason: str


class ReentrancyCheckResult(BaseModel):
    can_acquire: bool
    lock_key: str
    existing_lock: Optional[Dict[str, Any]] = None
    reason: str


class ValidationResult(BaseModel):
    is_valid: bool
    errors: List[str] = []
    warnings: List[str] = []
    dependency_check: Optional[DependencyCheckResult] = None
    window_check: Optional[WindowCheckResult] = None
    reentrancy_check: Optional[ReentrancyCheckResult] = None


class TaskExecutionRequest(BaseModel):
    task_instance_id: str
    executor_id: str = "default_executor"
