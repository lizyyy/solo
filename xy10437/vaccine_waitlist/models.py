from dataclasses import dataclass, field
from datetime import date
from typing import Optional, List
from enum import Enum


class AppointmentStatus(Enum):
    BOOKED = "booked"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class WaitingListStatus(Enum):
    PENDING = "pending"
    NOTIFIED = "notified"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    EXPIRED = "expired"


@dataclass
class Person:
    id: str
    name: str
    id_card: str
    birth_date: date
    gender: str
    phone: str

    @property
    def age(self) -> int:
        today = date.today()
        return today.year - self.birth_date.year - (
            (today.month, today.day) < (self.birth_date.month, self.birth_date.day)
        )


@dataclass
class VaccineBatch:
    id: str
    vaccine_name: str
    vaccine_type: str
    min_age_months: int
    max_age_months: int
    total_doses: int
    intervals_days: List[int] = field(default_factory=list)
    available_slots: int = 0
    date: date = None

    def is_age_qualified(self, person: Person) -> bool:
        age_months = person.age * 12
        return self.min_age_months <= age_months <= self.max_age_months

    def get_required_interval(self, dose_number: int) -> int:
        if dose_number <= 1:
            return 0
        if dose_number - 2 < len(self.intervals_days):
            return self.intervals_days[dose_number - 2]
        return 0


@dataclass
class DoseRecord:
    person_id: str
    vaccine_batch_id: str
    dose_number: int
    date: date


@dataclass
class Appointment:
    id: str
    person_id: str
    vaccine_batch_id: str
    dose_number: int
    appointment_date: date
    status: AppointmentStatus = AppointmentStatus.BOOKED
    cancelled_at: Optional[date] = None
    cancellation_id: Optional[str] = None


@dataclass
class WaitingListEntry:
    id: str
    person_id: str
    vaccine_batch_id: str
    dose_number: int
    status: WaitingListStatus = WaitingListStatus.PENDING
    priority: int = 0
    notified_at: Optional[date] = None
    confirmed_at: Optional[date] = None
    rejected_at: Optional[date] = None
    rejection_reason: Optional[str] = None
    created_at: date = None
    appointment_id: Optional[str] = None


@dataclass
class NotificationRecord:
    id: str
    waiting_list_entry_id: str
    person_id: str
    vaccine_batch_id: str
    dose_number: int
    notification_time: date
    order: int


@dataclass
class PromotedEntry:
    waiting_list_entry_id: str
    person_id: str
    vaccine_batch_id: str
    dose_number: int
    promoted_at: date
    source_cancellation_id: str


@dataclass
class RejectionReason:
    waiting_list_entry_id: str
    person_id: str
    vaccine_batch_id: str
    dose_number: int
    reason: str
    check_time: date
