from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Dict, Optional, Any


class LockStatus(Enum):
    NORMAL = "normal"
    SUSPICIOUS = "suspicious"
    LEAK = "leak"
    RELEASED = "released"


class TaskStatus(Enum):
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    UNKNOWN = "unknown"


class ReleaseResult(Enum):
    SUCCESS = "success"
    ALREADY_RELEASED = "already_released"
    ABORTED = "aborted"
    HEARTBEAT_ACTIVE = "heartbeat_active"
    CHECK_FAILED = "check_failed"


@dataclass
class LockSnapshot:
    lock_key: str
    lock_value: str
    holder_id: str
    holder_name: str
    holder_ip: str
    holder_pid: int
    acquired_at: datetime
    expire_at: datetime
    last_heartbeat_at: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class HeartbeatRecord:
    holder_id: str
    timestamp: datetime
    status: str
    load: Optional[float] = None
    memory_usage: Optional[float] = None


@dataclass
class ExecutionLog:
    lock_key: str
    holder_id: str
    event: str
    timestamp: datetime
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class LockPolicy:
    task_name: str
    lock_key_pattern: str
    max_execution_time: int
    heartbeat_interval: int
    heartbeat_timeout: int
    allowed_holders: List[str] = field(default_factory=list)
    description: str = ""


@dataclass
class LockAnalysis:
    lock_key: str
    status: LockStatus
    age_seconds: int
    age_human: str
    policy: Optional[LockPolicy]
    last_heartbeat: Optional[HeartbeatRecord]
    last_execution_log: Optional[ExecutionLog]
    risk_level: int
    reasons: List[str]
    recommendations: List[str]


@dataclass
class ReleaseRecord:
    lock_key: str
    release_time: datetime
    result: ReleaseResult
    confirmation_code: str
    checks: List[Dict[str, Any]]
    user_confirmation: Optional[str] = None
    task_recovered: Optional[bool] = None
    notes: Optional[str] = None


@dataclass
class AbnormalReport:
    type: str
    lock_key: str
    message: str
    timestamp: datetime
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DataSource:
    snapshots: List[LockSnapshot]
    heartbeats: List[HeartbeatRecord]
    execution_logs: List[ExecutionLog]
    policies: List[LockPolicy]
    release_history: List[ReleaseRecord] = field(default_factory=list)
    abnormal_reports: List[AbnormalReport] = field(default_factory=list)
