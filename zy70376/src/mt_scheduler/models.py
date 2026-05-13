from enum import Enum
from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskPriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class Task(BaseModel):
    id: str
    tenant_id: str
    name: str
    task_type: str
    priority: TaskPriority = TaskPriority.NORMAL
    weight: int = 1
    status: TaskStatus = TaskStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    retry_count: int = 0
    max_retries: int = 3
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    is_urgent_promotion: bool = False
    promotion_reason: Optional[str] = None
    execution_history: List[Dict[str, Any]] = Field(default_factory=list)


class TenantConfig(BaseModel):
    tenant_id: str
    name: str
    concurrency_quota: int = 2
    weight: int = 1
    max_queue_size: int = 100
    failure_penalty_percent: int = 20
    failure_threshold: int = 3
    is_active: bool = True
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TenantRuntimeState(BaseModel):
    tenant_id: str
    running_tasks: List[str] = Field(default_factory=list)
    pending_tasks: List[str] = Field(default_factory=list)
    completed_tasks: int = 0
    failed_tasks: int = 0
    consecutive_failures: int = 0
    quota_reduction_percent: int = 0
    last_failure_time: Optional[datetime] = None
    total_execution_time_ms: int = 0


class SchedulerState(BaseModel):
    version: int = 1
    tasks: Dict[str, Task] = Field(default_factory=dict)
    tenant_configs: Dict[str, TenantConfig] = Field(default_factory=dict)
    tenant_runtime: Dict[str, TenantRuntimeState] = Field(default_factory=dict)
    total_completed: int = 0
    total_failed: int = 0
    updated_at: datetime = Field(default_factory=datetime.now)
