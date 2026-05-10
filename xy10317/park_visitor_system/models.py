from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List


@dataclass
class Visitor:
    visitor_name: str
    visitor_id: str
    visitor_phone: str
    visitor_company: str


@dataclass
class Vehicle:
    plate_number: str
    vehicle_type: str = "小型车"
    color: str = ""


@dataclass
class Reservation:
    reservation_id: str
    visitor: Visitor
    vehicle: Vehicle
    intended_arrival_time: datetime
    intended_departure_time: datetime
    access_area: str
    approved: bool = True
    status: str = "active"
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class PlateChangeRequest:
    request_id: str
    original_plate: str
    new_plate: str
    reason: str
    requested_at: datetime = field(default_factory=datetime.now)
    approved: bool = False
    approved_at: Optional[datetime] = None


@dataclass
class BlacklistEntry:
    plate_number: str
    reason: str
    added_at: datetime = field(default_factory=datetime.now)
    added_by: str = "系统"


@dataclass
class GateEvent:
    event_id: str
    event_type: str
    plate_number: str
    event_time: datetime = field(default_factory=datetime.now)
    gate_name: str = "南门"
    operator: str = ""
    result: str = ""
    remark: str = ""


@dataclass
class GateShiftLog:
    log_id: str
    shift_start: datetime
    shift_end: datetime
    operator_on_duty: str
    events: List[GateEvent]
    total_entries: int = 0
    total_exits: int = 0
    blocked_entries: int = 0
    violations: int = 0


@dataclass
class DailyReport:
    report_date: str
    total_reservations: int
    actual_entries: int
    actual_exits: int
    blocked_entries: int
    expired_reservations: int
    overtime_exits: int
    average_stay_duration: str
