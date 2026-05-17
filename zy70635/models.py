from dataclasses import dataclass, field
from datetime import datetime, date, time
from typing import Optional, List
from enum import Enum


class Weekday(Enum):
    MONDAY = 0
    TUESDAY = 1
    WEDNESDAY = 2
    THURSDAY = 3
    FRIDAY = 4
    SATURDAY = 5
    SUNDAY = 6


@dataclass
class Student:
    student_id: str
    name: str
    grade: str
    class_name: str


@dataclass
class PickupPerson:
    person_id: str
    name: str
    phone: str
    relation: str
    student_id: str


@dataclass
class Authorization:
    auth_id: str
    student_id: str
    pickup_person_id: str
    start_date: date
    end_date: date
    weekdays: List[int]
    start_time: time
    end_time: time
    is_active: bool = True


@dataclass
class LeaveRecord:
    leave_id: str
    student_id: str
    leave_date: date
    reason: str
    is_half_day: bool = False
    half_day_type: Optional[str] = None


@dataclass
class LatePickupEvent:
    event_id: str
    student_id: str
    pickup_person_id: str
    pickup_date: date
    actual_pickup_time: time
    scheduled_end_time: time
    fee_amount: float = 0.0


@dataclass
class PickupReport:
    report_id: str
    report_date: date
    student_id: str
    pickup_person_id: Optional[str] = None
    pickup_time: Optional[time] = None
    is_authorized: bool = False
    is_late: bool = False
    is_on_leave: bool = False
    late_fee: float = 0.0
    notes: str = ""
