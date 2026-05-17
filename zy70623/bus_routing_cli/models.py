from dataclasses import dataclass, field
from datetime import datetime, date
from enum import Enum
from typing import Optional, List, Dict
import uuid


class RerouteReason(Enum):
    ROAD_CONSTRUCTION = "道路施工"
    ACCIDENT = "交通事故"
    WEATHER = "天气原因"
    TEMPORARY_RESTRICTION = "临时管制"
    OTHER = "其他"


class ConfirmationStatus(Enum):
    CONFIRMED = "已确认"
    PENDING = "待确认"
    REJECTED = "已拒绝"
    DUPLICATE = "重复回执"


class RecoveryStatus(Enum):
    PENDING = "待排查"
    IN_PROGRESS = "排查中"
    VERIFIED = "已验证恢复"
    FAILED = "恢复失败"
    CANCELLED = "已取消"


class ConfirmationChannel(Enum):
    WECHAT_GROUP = "家长群"
    PHONE = "电话"
    SMS = "短信"
    APP = "APP"
    OTHER = "其他"


@dataclass
class BusStop:
    stop_id: str
    name: str
    address: str
    is_temporary: bool = False
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    def __post_init__(self):
        if not self.stop_id:
            self.stop_id = str(uuid.uuid4())[:8]


@dataclass
class Student:
    student_id: str
    name: str
    grade: str
    class_name: str
    primary_contact: str
    phone_number: str
    default_stop_id: str

    def __post_init__(self):
        if not self.student_id:
            self.student_id = str(uuid.uuid4())[:8]


@dataclass
class BusRoute:
    route_id: str
    route_number: str
    name: str
    stops: List[BusStop] = field(default_factory=list)
    students: List[Student] = field(default_factory=list)
    is_active: bool = True

    def __post_init__(self):
        if not self.route_id:
            self.route_id = str(uuid.uuid4())[:8]


@dataclass
class ReroutePlan:
    reroute_id: str
    route_id: str
    reason: RerouteReason
    reason_detail: str
    effective_date: date
    expiry_date: Optional[date] = None
    original_stop_replacements: Dict[str, BusStop] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    created_by: str = ""

    def __post_init__(self):
        if not self.reroute_id:
            self.reroute_id = str(uuid.uuid4())[:8]


@dataclass
class ParentConfirmation:
    confirmation_id: str
    student_id: str
    reroute_id: str
    status: ConfirmationStatus
    channel: ConfirmationChannel
    confirmed_at: Optional[datetime] = None
    parent_name: str = ""
    notes: str = ""
    is_late: bool = False
    original_stop_id: Optional[str] = None
    new_stop_id: Optional[str] = None

    def __post_init__(self):
        if not self.confirmation_id:
            self.confirmation_id = str(uuid.uuid4())[:8]


@dataclass
class RecoveryCheck:
    check_id: str
    reroute_id: str
    status: RecoveryStatus
    checked_at: Optional[datetime] = None
    checked_by: str = ""
    issues_found: List[str] = field(default_factory=list)
    resolution_notes: str = ""

    def __post_init__(self):
        if not self.check_id:
            self.check_id = str(uuid.uuid4())[:8]
