from dataclasses import dataclass
from typing import Optional, List
from datetime import datetime

@dataclass
class Resident:
    id: Optional[int]
    name: str
    phone: Optional[str]
    building: str
    unit: Optional[str]
    room: Optional[str]

@dataclass
class Vehicle:
    id: Optional[int]
    plate_number: str
    capacity_cubic: float
    driver_name: Optional[str]
    is_active: bool = True

@dataclass
class Appointment:
    id: Optional[int]
    resident_id: int
    appointment_date: str
    time_slot: str
    volume_cubic: float
    payment_status: str = 'unpaid'
    source: Optional[str] = None
    import_batch_id: Optional[str] = None

@dataclass
class Violation:
    id: Optional[int]
    resident_id: int
    violation_date: str
    violation_type: str
    description: Optional[str] = None
    has_complaint: bool = False
    is_resolved: bool = False

@dataclass
class Schedule:
    id: Optional[int]
    appointment_id: int
    vehicle_id: int
    schedule_date: str
    sequence: Optional[int] = None
    status: str = 'pending'
    notes: Optional[str] = None

@dataclass
class Anomaly:
    id: Optional[int]
    anomaly_type: str
    description: str
    severity: str = 'warning'
    appointment_id: Optional[int] = None
    resident_id: Optional[int] = None
    is_resolved: bool = False
    resolution: Optional[str] = None

VALID_PAYMENT_STATUSES = ['paid', 'unpaid', 'partial']
VALID_TIME_SLOTS = ['morning', 'afternoon', 'evening']
VALID_VIOLATION_TYPES = ['illegal_dumping', 'exceeding_quota', 'wrong_time', 'other']
VALID_ANOMALY_TYPES = ['unpaid_appointment', 'duplicate_appointment', 'overloaded_vehicle', 'violation_skipped', 'volume_mismatch', 'other']
VALID_SEVERITIES = ['low', 'warning', 'high', 'critical']
VALID_SCHEDULE_STATUSES = ['pending', 'scheduled', 'completed', 'cancelled', 'skipped']
