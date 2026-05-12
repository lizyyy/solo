from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Set
from datetime import datetime


class TaskStatus(str, Enum):
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"
    PENDING = "pending"
    BLOCKED = "blocked"


class SkipType(str, Enum):
    AUTO = "auto"
    MANUAL = "manual"


@dataclass
class TaskDefinition:
    task_id: str
    name: str
    dependencies: List[str] = field(default_factory=list)
    description: str = ""
    group: str = ""
    category: str = ""


@dataclass
class FailureRecord:
    task_id: str
    run_date: str
    failure_time: datetime
    reason: str
    import_hash: str = ""


@dataclass
class SkipRecord:
    task_id: str
    run_date: str
    skip_type: SkipType
    reason: str
    created_at: datetime
    import_hash: str = ""


@dataclass
class RunStatus:
    task_id: str
    run_date: str
    status: TaskStatus
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    reason: str = ""
    import_hash: str = ""


@dataclass
class GraphAnalysis:
    cycles: List[List[str]] = field(default_factory=list)
    missing_dependencies: List[str] = field(default_factory=list)
    orphan_tasks: List[str] = field(default_factory=list)
    topological_order: List[str] = field(default_factory=list)


@dataclass
class ImpactAnalysis:
    failed_tasks: List[str] = field(default_factory=list)
    affected_downstream: List[str] = field(default_factory=list)
    blocked_tasks: List[str] = field(default_factory=list)
    safe_to_rerun: List[str] = field(default_factory=list)


@dataclass
class RerunPlan:
    task_id: str
    technical_safe: bool
    business_recommended: bool
    suggested_action: str
    blocked_by: List[str] = field(default_factory=list)
    depends_on: List[str] = field(default_factory=list)
    skip_reason: str = ""
