from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any


class RepairStatus(str, Enum):
    SUBMITTED = "submitted"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FOLLOWED_UP = "followed_up"
    CLOSED = "closed"
    REPEAT = "repeat"


class ResponsibilityType(str, Enum):
    NATURAL_DAMAGE = "natural_damage"
    STUDENT_RESPONSIBLE = "student_responsible"
    UNDETERMINED = "undetermined"


class FollowUpResult(str, Enum):
    SATISFIED = "satisfied"
    NEEDS_REWORK = "needs_rework"
    UNCONFIRMED = "unconfirmed"
    NOT_ATTEMPTED = "not_attempted"


@dataclass
class Dormitory:
    dorm_id: str
    building: str
    room_number: str
    floor: int
    capacity: int
    students: List[str] = field(default_factory=list)
    counselor: Optional[str] = None
    remarks: Optional[str] = None


@dataclass
class RepairPerson:
    staff_id: str
    name: str
    phone: str
    skills: List[str]
    work_area: List[str]


@dataclass
class Material:
    material_id: str
    name: str
    unit: str
    unit_price: float
    current_stock: float
    min_stock: float = 0
    category: Optional[str] = None


@dataclass
class RepairOrder:
    order_id: str
    dorm_id: str
    submit_time: datetime
    reporter: str
    reporter_phone: str
    description: str
    category: Optional[str] = None
    status: RepairStatus = RepairStatus.SUBMITTED
    assigned_to: Optional[str] = None
    responsibility: ResponsibilityType = ResponsibilityType.UNDETERMINED
    start_time: Optional[datetime] = None
    complete_time: Optional[datetime] = None
    follow_up_time: Optional[datetime] = None
    follow_up_result: FollowUpResult = FollowUpResult.NOT_ATTEMPTED
    follow_up_remarks: Optional[str] = None
    close_time: Optional[datetime] = None
    student_fee: float = 0.0
    is_repeat: bool = False
    original_order_id: Optional[str] = None
    materials: List[Dict[str, Any]] = field(default_factory=list)
    repairs: List[str] = field(default_factory=list)
    history: List[Dict[str, Any]] = field(default_factory=list)
    remarks: Optional[str] = None


@dataclass
class MaterialUsage:
    order_id: str
    material_id: str
    material_name: str
    quantity: float
    unit_price: float
    total_cost: float
    timestamp: datetime
    operator: str


@dataclass
class AuditLog:
    log_id: str
    timestamp: datetime
    action: str
    target_type: str
    target_id: str
    operator: str
    before: Optional[Dict[str, Any]] = None
    after: Optional[Dict[str, Any]] = None
    reason: Optional[str] = None


@dataclass
class ImportRecord:
    import_id: str
    import_time: datetime
    file_type: str
    file_name: str
    total_count: int
    success_count: int
    failed_count: int
    operator: str
    errors: List[Dict[str, Any]] = field(default_factory=list)
