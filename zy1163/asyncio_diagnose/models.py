from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class TaskState(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    CANCELLED = "cancelled"
    CANCEL_PENDING = "cancel_pending"


@dataclass
class TaskInfo:
    task_id: str
    name: Optional[str]
    state: TaskState
    coro_name: str
    created_at: datetime
    last_updated_at: datetime
    waiting_on: Optional[str] = None
    awaited_by: List[str] = field(default_factory=list)
    cancel_requested: bool = False
    cancel_time: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EventLoopTrace:
    timestamp: datetime
    event_type: str
    task_id: str
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AwaitEdge:
    from_task: str
    to_task: str
    await_time: datetime
    resolved_time: Optional[datetime] = None


@dataclass
class TimeoutRule:
    task_pattern: str
    timeout_seconds: float
    description: str = ""


@dataclass
class AnalysisResult:
    long_pending_tasks: List[TaskInfo] = field(default_factory=list)
    task_leaks: List[TaskInfo] = field(default_factory=list)
    ineffective_cancellations: List[TaskInfo] = field(default_factory=list)
    timeout_chains: List[List[str]] = field(default_factory=list)
    queue_congestion: List[Dict[str, Any]] = field(default_factory=list)
    wait_chains: List[List[str]] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)
