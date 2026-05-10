from dataclasses import dataclass, field, asdict
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from enum import Enum


class DeviceStatus(Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    MAINTENANCE = "maintenance"


class InspectionStatus(Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    MISSED = "missed"
    EXCEPTION = "exception"


class SuppliesType(Enum):
    ELECTRODE_PADS = "electrode_pads"
    BATTERY = "battery"


class ApprovalStatus(Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


@dataclass
class AEDDevice:
    device_id: str
    location: str
    floor: str
    room: str
    model: str
    serial_number: str
    installation_date: str
    status: str = DeviceStatus.ACTIVE.value
    last_inspection_date: Optional[str] = None
    next_inspection_date: Optional[str] = None
    assigned_volunteer_id: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class Volunteer:
    volunteer_id: str
    name: str
    phone: str
    area: str
    email: Optional[str] = None
    is_active: bool = True
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class Supplies:
    supplies_id: str
    device_id: str
    supplies_type: str
    batch_number: str
    expiration_date: str
    installation_date: str
    replacement_date: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class InspectionPlan:
    plan_id: str
    device_id: str
    volunteer_id: str
    plan_date: str
    frequency_days: int = 7
    status: str = InspectionStatus.PENDING.value
    checkin_time: Optional[str] = None
    inspection_time: Optional[str] = None
    notes: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class CheckinRecord:
    checkin_id: str
    plan_id: str
    volunteer_id: str
    device_id: str
    checkin_time: str
    checkin_method: str
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class InspectionReport:
    report_id: str
    plan_id: str
    volunteer_id: str
    device_id: str
    inspection_date: str
    electrode_pads_ok: bool
    battery_ok: bool
    location_visible: bool
    device_clean: bool
    overall_status: str
    notes: Optional[str] = None
    approval_status: str = ApprovalStatus.PENDING.value
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class ExceptionRecord:
    exception_id: str
    device_id: str
    exception_type: str
    exception_date: str
    description: str
    severity: str
    resolved: bool = False
    resolution_notes: Optional[str] = None
    resolved_at: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


def to_dict(obj: Any) -> Dict[str, Any]:
    return asdict(obj)


def from_dict(cls: type, data: Dict[str, Any]) -> Any:
    return cls(**data)
