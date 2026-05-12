from dataclasses import dataclass, field, asdict
from datetime import datetime, date, time, timedelta
from enum import Enum
from typing import List, Optional, Dict, Any
import json
import uuid


class InterviewStatus(str, Enum):
    PENDING = "pending"
    SCHEDULED = "scheduled"
    CONFIRMED = "confirmed"
    RESCHEDULED = "rescheduled"
    CANDIDATE_NO_SHOW = "candidate_no_show"
    INTERVIEWER_NO_SHOW = "interviewer_no_show"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class RoundType(str, Enum):
    FIRST = "first"
    SECOND = "second"
    FINAL = "final"


@dataclass
class TimeSlot:
    start: datetime
    end: datetime

    def to_dict(self) -> Dict[str, str]:
        return {
            "start": self.start.isoformat(),
            "end": self.end.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, str]) -> "TimeSlot":
        return cls(
            start=datetime.fromisoformat(data["start"]),
            end=datetime.fromisoformat(data["end"]),
        )

    def overlaps_with(self, other: "TimeSlot") -> bool:
        return self.start < other.end and other.start < self.end

    def __str__(self) -> str:
        return f"{self.start.strftime('%Y-%m-%d %H:%M')} - {self.end.strftime('%H:%M')}"


@dataclass
class Candidate:
    id: str
    name: str
    position: str
    email: str
    phone: str
    department: str
    status: str = "active"
    notes: str = ""
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "position": self.position,
            "email": self.email,
            "phone": self.phone,
            "department": self.department,
            "status": self.status,
            "notes": self.notes,
            "created_at": self.created_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Candidate":
        return cls(
            id=data["id"],
            name=data["name"],
            position=data["position"],
            email=data["email"],
            phone=data["phone"],
            department=data["department"],
            status=data.get("status", "active"),
            notes=data.get("notes", ""),
            created_at=datetime.fromisoformat(data["created_at"]),
        )


@dataclass
class Interviewer:
    id: str
    name: str
    email: str
    departments: List[str]
    available_slots: List[TimeSlot] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "departments": self.departments,
            "available_slots": [slot.to_dict() for slot in self.available_slots],
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Interviewer":
        return cls(
            id=data["id"],
            name=data["name"],
            email=data["email"],
            departments=data["departments"],
            available_slots=[TimeSlot.from_dict(s) for s in data.get("available_slots", [])],
        )


@dataclass
class Room:
    id: str
    name: str
    capacity: int
    building: str
    room_number: str
    equipment: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "capacity": self.capacity,
            "building": self.building,
            "room_number": self.room_number,
            "equipment": self.equipment,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Room":
        return cls(
            id=data["id"],
            name=data["name"],
            capacity=data["capacity"],
            building=data["building"],
            room_number=data["room_number"],
            equipment=data.get("equipment", []),
        )


@dataclass
class RoundRule:
    round_type: RoundType
    position_type: str
    duration_minutes: int
    min_gap_hours: int
    required_interviewers: int
    required_equipment: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "round_type": self.round_type.value,
            "position_type": self.position_type,
            "duration_minutes": self.duration_minutes,
            "min_gap_hours": self.min_gap_hours,
            "required_interviewers": self.required_interviewers,
            "required_equipment": self.required_equipment,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RoundRule":
        return cls(
            round_type=RoundType(data["round_type"]),
            position_type=data["position_type"],
            duration_minutes=data["duration_minutes"],
            min_gap_hours=data["min_gap_hours"],
            required_interviewers=data["required_interviewers"],
            required_equipment=data.get("required_equipment", []),
        )


@dataclass
class RescheduleRecord:
    id: str
    interview_id: str
    original_slot: Optional[TimeSlot]
    new_slot: Optional[TimeSlot]
    original_room_id: Optional[str]
    new_room_id: Optional[str]
    reason: str
    requested_by: str
    requested_at: datetime
    is_resolved: bool = False
    resolution_notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "interview_id": self.interview_id,
            "original_slot": self.original_slot.to_dict() if self.original_slot else None,
            "new_slot": self.new_slot.to_dict() if self.new_slot else None,
            "original_room_id": self.original_room_id,
            "new_room_id": self.new_room_id,
            "reason": self.reason,
            "requested_by": self.requested_by,
            "requested_at": self.requested_at.isoformat(),
            "is_resolved": self.is_resolved,
            "resolution_notes": self.resolution_notes,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RescheduleRecord":
        return cls(
            id=data["id"],
            interview_id=data["interview_id"],
            original_slot=TimeSlot.from_dict(data["original_slot"]) if data.get("original_slot") else None,
            new_slot=TimeSlot.from_dict(data["new_slot"]) if data.get("new_slot") else None,
            original_room_id=data.get("original_room_id"),
            new_room_id=data.get("new_room_id"),
            reason=data["reason"],
            requested_by=data["requested_by"],
            requested_at=datetime.fromisoformat(data["requested_at"]),
            is_resolved=data.get("is_resolved", False),
            resolution_notes=data.get("resolution_notes", ""),
        )


@dataclass
class Interview:
    id: str
    candidate_id: str
    round_type: RoundType
    slot: Optional[TimeSlot] = None
    interviewer_ids: List[str] = field(default_factory=list)
    room_id: Optional[str] = None
    status: InterviewStatus = InterviewStatus.PENDING
    priority: int = 0
    reschedule_count: int = 0
    reschedule_history: List[RescheduleRecord] = field(default_factory=list)
    operator: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "candidate_id": self.candidate_id,
            "round_type": self.round_type.value,
            "slot": self.slot.to_dict() if self.slot else None,
            "interviewer_ids": self.interviewer_ids,
            "room_id": self.room_id,
            "status": self.status.value,
            "priority": self.priority,
            "reschedule_count": self.reschedule_count,
            "reschedule_history": [r.to_dict() for r in self.reschedule_history],
            "operator": self.operator,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Interview":
        return cls(
            id=data["id"],
            candidate_id=data["candidate_id"],
            round_type=RoundType(data["round_type"]),
            slot=TimeSlot.from_dict(data["slot"]) if data.get("slot") else None,
            interviewer_ids=data.get("interviewer_ids", []),
            room_id=data.get("room_id"),
            status=InterviewStatus(data["status"]),
            priority=data.get("priority", 0),
            reschedule_count=data.get("reschedule_count", 0),
            reschedule_history=[RescheduleRecord.from_dict(r) for r in data.get("reschedule_history", [])],
            operator=data.get("operator"),
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
            notes=data.get("notes", ""),
        )


@dataclass
class ScheduleState:
    candidates: Dict[str, Candidate] = field(default_factory=dict)
    interviewers: Dict[str, Interviewer] = field(default_factory=dict)
    rooms: Dict[str, Room] = field(default_factory=dict)
    round_rules: Dict[str, RoundRule] = field(default_factory=dict)
    interviews: Dict[str, Interview] = field(default_factory=dict)
    last_updated: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "candidates": {k: v.to_dict() for k, v in self.candidates.items()},
            "interviewers": {k: v.to_dict() for k, v in self.interviewers.items()},
            "rooms": {k: v.to_dict() for k, v in self.rooms.items()},
            "round_rules": {k: v.to_dict() for k, v in self.round_rules.items()},
            "interviews": {k: v.to_dict() for k, v in self.interviews.items()},
            "last_updated": self.last_updated.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ScheduleState":
        return cls(
            candidates={k: Candidate.from_dict(v) for k, v in data.get("candidates", {}).items()},
            interviewers={k: Interviewer.from_dict(v) for k, v in data.get("interviewers", {}).items()},
            rooms={k: Room.from_dict(v) for k, v in data.get("rooms", {}).items()},
            round_rules={k: RoundRule.from_dict(v) for k, v in data.get("round_rules", {}).items()},
            interviews={k: Interview.from_dict(v) for k, v in data.get("interviews", {}).items()},
            last_updated=datetime.fromisoformat(data.get("last_updated", datetime.now().isoformat())),
        )


def generate_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"
