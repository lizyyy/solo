from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import date, datetime
from enum import Enum
from typing import Any, Optional


class BarrierType(str, Enum):
    KNOCK_IN = "knock_in"
    KNOCK_OUT = "knock_out"


class BarrierDirection(str, Enum):
    UP = "up"
    DOWN = "down"


class ObservationFreq(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    CUSTOM = "custom"


class JudgmentStatus(str, Enum):
    NOT_BREACHED = "not_breached"
    BREACHED = "breached"
    PENDING = "pending"


class ReminderEventType(str, Enum):
    BARRIER_BREACH = "barrier_breach"
    MISSING_OBSERVATION = "missing_observation"
    PRICE_TIMESTAMP_ERROR = "price_timestamp_error"
    MISSING_CONDITION = "missing_condition"


class ProblemType(str, Enum):
    MISSING_BARRIER_CONDITION = "missing_barrier_condition"
    MISSING_OBSERVATION_CALENDAR = "missing_observation_calendar"
    MISSING_OBSERVATION_PRICE = "missing_observation_price"
    PRICE_TIMESTAMP_MISMATCH = "price_timestamp_mismatch"
    INCOMPLETE_DATA = "incomplete_data"


@dataclass
class Contract:
    contract_id: str
    client_id: str
    underlying: str
    option_type: str
    start_date: date
    end_date: date
    observation_freq: ObservationFreq = ObservationFreq.DAILY
    observation_dates: Optional[list[date]] = None
    barrier_type: Optional[BarrierType] = None
    barrier_level: Optional[float] = None
    barrier_direction: Optional[BarrierDirection] = None

    @property
    def has_barrier_condition(self) -> bool:
        return (
            self.barrier_type is not None
            and self.barrier_level is not None
            and self.barrier_direction is not None
        )

    @property
    def has_observation_calendar(self) -> bool:
        return self.observation_dates is not None and len(self.observation_dates) > 0

    def to_dict(self) -> dict:
        d = {
            "contract_id": self.contract_id,
            "client_id": self.client_id,
            "underlying": self.underlying,
            "option_type": self.option_type,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "observation_freq": self.observation_freq.value,
        }
        if self.observation_dates is not None:
            d["observation_dates"] = [od.isoformat() for od in self.observation_dates]
        if self.barrier_type is not None:
            d["barrier_type"] = self.barrier_type.value
        if self.barrier_level is not None:
            d["barrier_level"] = self.barrier_level
        if self.barrier_direction is not None:
            d["barrier_direction"] = self.barrier_direction.value
        return d

    @classmethod
    def from_dict(cls, d: dict) -> Contract:
        return cls(
            contract_id=d["contract_id"],
            client_id=d["client_id"],
            underlying=d["underlying"],
            option_type=d["option_type"],
            start_date=date.fromisoformat(d["start_date"]),
            end_date=date.fromisoformat(d["end_date"]),
            observation_freq=ObservationFreq(d.get("observation_freq", "daily")),
            observation_dates=(
                [date.fromisoformat(x) for x in d["observation_dates"]]
                if "observation_dates" in d and d["observation_dates"]
                else None
            ),
            barrier_type=(
                BarrierType(d["barrier_type"])
                if "barrier_type" in d and d["barrier_type"]
                else None
            ),
            barrier_level=d.get("barrier_level"),
            barrier_direction=(
                BarrierDirection(d["barrier_direction"])
                if "barrier_direction" in d and d["barrier_direction"]
                else None
            ),
        )


@dataclass
class ObservationPrice:
    contract_id: str
    observation_date: date
    price: float
    timestamp: datetime
    source: str = ""

    @property
    def price_id(self) -> str:
        return f"{self.contract_id}:{self.observation_date.isoformat()}"

    def to_dict(self) -> dict:
        return {
            "contract_id": self.contract_id,
            "observation_date": self.observation_date.isoformat(),
            "price": self.price,
            "timestamp": self.timestamp.isoformat(),
            "source": self.source,
        }

    @classmethod
    def from_dict(cls, d: dict) -> ObservationPrice:
        return cls(
            contract_id=d["contract_id"],
            observation_date=date.fromisoformat(d["observation_date"]),
            price=d["price"],
            timestamp=datetime.fromisoformat(d["timestamp"]),
            source=d.get("source", ""),
        )


@dataclass
class BarrierJudgment:
    contract_id: str
    observation_date: date
    status: JudgmentStatus
    breach_type: Optional[str] = None
    price_at_observation: Optional[float] = None
    barrier_level_used: Optional[float] = None
    determined_at: Optional[datetime] = None
    manually_overridden: bool = False
    override_reason: Optional[str] = None

    @property
    def judgment_id(self) -> str:
        return f"{self.contract_id}:{self.observation_date.isoformat()}"

    def to_dict(self) -> dict:
        return {
            "contract_id": self.contract_id,
            "observation_date": self.observation_date.isoformat(),
            "status": self.status.value,
            "breach_type": self.breach_type,
            "price_at_observation": self.price_at_observation,
            "barrier_level_used": self.barrier_level_used,
            "determined_at": (
                self.determined_at.isoformat() if self.determined_at else None
            ),
            "manually_overridden": self.manually_overridden,
            "override_reason": self.override_reason,
        }

    @classmethod
    def from_dict(cls, d: dict) -> BarrierJudgment:
        return cls(
            contract_id=d["contract_id"],
            observation_date=date.fromisoformat(d["observation_date"]),
            status=JudgmentStatus(d["status"]),
            breach_type=d.get("breach_type"),
            price_at_observation=d.get("price_at_observation"),
            barrier_level_used=d.get("barrier_level_used"),
            determined_at=(
                datetime.fromisoformat(d["determined_at"])
                if d.get("determined_at")
                else None
            ),
            manually_overridden=d.get("manually_overridden", False),
            override_reason=d.get("override_reason"),
        )


@dataclass
class Reminder:
    client_id: str
    contract_id: str
    event_type: ReminderEventType
    message: str
    observation_date: Optional[date] = None
    created_at: Optional[datetime] = None
    sent: bool = False

    @property
    def reminder_id(self) -> str:
        date_part = self.observation_date.isoformat() if self.observation_date else "none"
        raw = f"{self.client_id}:{self.contract_id}:{self.event_type.value}:{date_part}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    def to_dict(self) -> dict:
        return {
            "reminder_id": self.reminder_id,
            "client_id": self.client_id,
            "contract_id": self.contract_id,
            "event_type": self.event_type.value,
            "message": self.message,
            "observation_date": (
                self.observation_date.isoformat() if self.observation_date else None
            ),
            "created_at": (
                self.created_at.isoformat() if self.created_at else None
            ),
            "sent": self.sent,
        }

    @classmethod
    def from_dict(cls, d: dict) -> Reminder:
        return cls(
            client_id=d["client_id"],
            contract_id=d["contract_id"],
            event_type=ReminderEventType(d["event_type"]),
            message=d["message"],
            observation_date=(
                date.fromisoformat(d["observation_date"])
                if d.get("observation_date")
                else None
            ),
            created_at=(
                datetime.fromisoformat(d["created_at"])
                if d.get("created_at")
                else None
            ),
            sent=d.get("sent", False),
        )


@dataclass
class HistoryEntry:
    contract_id: str
    field_changed: str
    old_value: Any
    new_value: Any
    changed_by: str
    changed_at: datetime
    reason: Optional[str] = None

    @property
    def entry_id(self) -> str:
        raw = (
            f"{self.contract_id}:{self.field_changed}:{self.changed_at.isoformat()}"
        )
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    def to_dict(self) -> dict:
        return {
            "entry_id": self.entry_id,
            "contract_id": self.contract_id,
            "field_changed": self.field_changed,
            "old_value": _serialize_value(self.old_value),
            "new_value": _serialize_value(self.new_value),
            "changed_by": self.changed_by,
            "changed_at": self.changed_at.isoformat(),
            "reason": self.reason,
        }

    @classmethod
    def from_dict(cls, d: dict) -> HistoryEntry:
        return cls(
            contract_id=d["contract_id"],
            field_changed=d["field_changed"],
            old_value=d["old_value"],
            new_value=d["new_value"],
            changed_by=d["changed_by"],
            changed_at=datetime.fromisoformat(d["changed_at"]),
            reason=d.get("reason"),
        )


@dataclass
class ProblemRecord:
    contract_id: str
    problem_type: ProblemType
    detail: str
    related_material: str
    observation_date: Optional[date] = None


@dataclass
class NormalRecord:
    contract_id: str
    observation_date: date
    price: float
    barrier_level: float
    barrier_direction: str
    judgment: str
    barrier_type: str = ""
    manually_overridden: bool = False


@dataclass
class DailyReport:
    report_date: date
    normal_records: list[NormalRecord] = field(default_factory=list)
    problem_records: list[ProblemRecord] = field(default_factory=list)
    new_reminders: list[Reminder] = field(default_factory=list)
    existing_reminders: list[Reminder] = field(default_factory=list)
    history_entries: list[HistoryEntry] = field(default_factory=list)


def _serialize_value(v: Any) -> Any:
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, Enum):
        return v.value
    return v
