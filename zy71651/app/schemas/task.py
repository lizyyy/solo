from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import Field

from .base import BaseSchema, TimestampMixin
from ..models.enums import TaskStatus, TaskStatusCategory


class TaskBase(BaseSchema):
    project_name: str = Field(..., max_length=200, description="项目名称")
    description: Optional[str] = Field(None, description="项目描述")
    student_id: Optional[int] = Field(None, description="学生ID")
    tags: Optional[List[str]] = Field(default_factory=list, description="标签")
    config: Optional[Dict[str, Any]] = Field(default_factory=dict, description="配置")
    notes: Optional[str] = Field(None, description="备注")


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseSchema):
    project_name: Optional[str] = None
    description: Optional[str] = None
    student_id: Optional[int] = None
    tags: Optional[List[str]] = None
    config: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None


class TaskStatusInfo(BaseSchema):
    status: TaskStatus
    status_category: TaskStatusCategory
    status_display: str


class TaskStatusLogResponse(TimestampMixin):
    id: int
    task_id: int
    previous_status: Optional[TaskStatus]
    new_status: TaskStatus
    message: Optional[str]
    triggered_by: Optional[str]
    metadata: Optional[Dict[str, Any]]


class TaskSummary(TimestampMixin):
    id: int
    project_name: str
    description: Optional[str]
    student_id: Optional[int]
    student_name: Optional[str]
    status: TaskStatus
    status_category: TaskStatusCategory
    status_display: str
    current_params_version: int
    tags: List[str]
    has_model: bool
    has_analysis: bool
    has_estimation: bool
    has_report: bool
    anomaly_count: int
    critical_anomaly_count: int
    total_mass_g: Optional[float]
    print_time_hours: Optional[float]


class TaskDetailResponse(TaskSummary):
    model_files: List[Dict[str, Any]]
    params_versions: List[Dict[str, Any]]
    status_history: List[TaskStatusLogResponse]
    active_estimation: Optional[Dict[str, Any]]
    anomalies: List[Dict[str, Any]]
    latest_analysis: Optional[Dict[str, Any]]
    latest_report: Optional[Dict[str, Any]]


class TaskStatusTransitionRequest(BaseSchema):
    target_status: TaskStatus
    message: Optional[str] = None
    triggered_by: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class TaskStatusTransitionResponse(BaseSchema):
    task_id: int
    previous_status: TaskStatus
    new_status: TaskStatus
    allowed: bool
    reason: Optional[str] = None
