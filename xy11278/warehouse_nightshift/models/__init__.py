from dataclasses import dataclass, field
from datetime import datetime, date
from enum import Enum
from typing import Optional, List, Dict, Any


class TaskStatus(Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    EXCEPTION = "exception"


class ExceptionType(Enum):
    LOW_BATTERY = "low_battery"
    CHARGING_STATION_OCCUPIED = "charging_station_occupied"
    TASK_CONFLICT = "task_conflict"
    INVALID_DATA = "invalid_data"
    FORKLIFT_UNAVAILABLE = "forklift_unavailable"
    OPERATOR_ABSENT = "operator_absent"


class ImportStatus(Enum):
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"


@dataclass
class Forklift:
    id: str
    name: str
    battery_level: int
    status: str
    last_maintenance: date
    current_operator: Optional[str] = None
    current_station: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class ChargingStation:
    id: str
    name: str
    status: str
    occupied_by: Optional[str] = None
    occupied_since: Optional[datetime] = None
    expected_free_time: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class Task:
    id: str
    title: str
    description: str
    priority: int
    assigned_forklift: Optional[str] = None
    assigned_operator: Optional[str] = None
    status: TaskStatus = TaskStatus.PENDING
    scheduled_date: Optional[date] = None
    shift: Optional[str] = None
    estimated_duration: int = 60
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    exception_type: Optional[ExceptionType] = None
    exception_note: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class Schedule:
    id: str
    schedule_date: date
    shift: str
    forklift_assignments: Dict[str, str]
    task_order: List[str]
    notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class ImportRecord:
    id: str
    import_type: str
    file_name: str
    status: ImportStatus
    total_records: int
    success_count: int
    failed_count: int
    imported_by: str
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class FailedRecord:
    id: str
    import_id: str
    record_type: str
    original_data: str
    row_number: int
    error_message: str
    suggestion: str
    resolved: bool = False
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class OperationLog:
    id: str
    action: str
    entity_type: str
    entity_id: str
    details: Dict[str, Any]
    operator: str
    created_at: datetime = field(default_factory=datetime.now)
