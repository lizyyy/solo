from datetime import datetime
from typing import Optional, List
from enum import Enum
from pydantic import BaseModel
from .base import BaseEntity


class AppointmentStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CHECKED_IN = "checked_in"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    RESCHEDULED = "rescheduled"
    REJECTED = "rejected"


class AppointmentChangeLog(BaseModel):
    changed_at: datetime
    changed_by: str
    old_status: Optional[AppointmentStatus] = None
    new_status: AppointmentStatus
    old_time: Optional[datetime] = None
    new_time: Optional[datetime] = None
    reason: Optional[str] = None


class Appointment(BaseEntity):
    elder_id: str
    visitor_ids: List[str]
    room_number: str
    scheduled_start: datetime
    scheduled_end: datetime
    status: AppointmentStatus = AppointmentStatus.PENDING
    health_declaration_ids: List[str] = []
    change_history: List[AppointmentChangeLog] = []
    notes: Optional[str] = None
    operator: Optional[str] = None

    def can_transition_to(self, new_status: AppointmentStatus) -> bool:
        valid_transitions = {
            AppointmentStatus.PENDING: [
                AppointmentStatus.CONFIRMED,
                AppointmentStatus.CANCELLED,
                AppointmentStatus.REJECTED
            ],
            AppointmentStatus.CONFIRMED: [
                AppointmentStatus.CHECKED_IN,
                AppointmentStatus.CANCELLED,
                AppointmentStatus.RESCHEDULED
            ],
            AppointmentStatus.CHECKED_IN: [
                AppointmentStatus.COMPLETED,
                AppointmentStatus.CANCELLED
            ],
            AppointmentStatus.RESCHEDULED: [
                AppointmentStatus.CONFIRMED,
                AppointmentStatus.CANCELLED
            ],
            AppointmentStatus.COMPLETED: [],
            AppointmentStatus.CANCELLED: [],
            AppointmentStatus.REJECTED: []
        }
        return new_status in valid_transitions.get(self.status, [])
