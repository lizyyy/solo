from dataclasses import dataclass, field
from datetime import datetime, time
from enum import Enum
from typing import List, Optional, Dict, Any
import json


class DayOfWeek(Enum):
    MONDAY = "周一"
    TUESDAY = "周二"
    WEDNESDAY = "周三"
    THURSDAY = "周四"
    FRIDAY = "周五"
    SATURDAY = "周六"
    SUNDAY = "周日"


class SkillTag(Enum):
    TEACHING = "教学"
    ASSISTANT = "助教"
    TECHNICAL = "技术支持"
    ADMIN = "行政"
    FIRST_AID = "急救"
    TRANSLATION = "翻译"


class LeaveType(Enum):
    SICK = "病假"
    PERSONAL = "事假"
    ANNUAL = "年假"
    OTHER = "其他"


@dataclass
class TimeSlot:
    day: DayOfWeek
    start_time: time
    end_time: time
    
    def __str__(self) -> str:
        return f"{self.day.value} {self.start_time.strftime('%H:%M')}-{self.end_time.strftime('%H:%M')}"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "day": self.day.value,
            "start_time": self.start_time.strftime("%H:%M"),
            "end_time": self.end_time.strftime("%H:%M")
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TimeSlot':
        day_map = {d.value: d for d in DayOfWeek}
        day = day_map[data["day"]]
        start_time = datetime.strptime(data["start_time"], "%H:%M").time()
        end_time = datetime.strptime(data["end_time"], "%H:%M").time()
        return cls(day=day, start_time=start_time, end_time=end_time)


@dataclass
class Volunteer:
    id: str
    name: str
    phone: str
    email: str = ""
    skills: List[SkillTag] = field(default_factory=list)
    available_slots: List[TimeSlot] = field(default_factory=list)
    max_hours_per_week: float = 8.0
    notes: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "phone": self.phone,
            "email": self.email,
            "skills": [s.value for s in self.skills],
            "available_slots": [slot.to_dict() for slot in self.available_slots],
            "max_hours_per_week": self.max_hours_per_week,
            "notes": self.notes
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Volunteer':
        skill_map = {s.value: s for s in SkillTag}
        skills = [skill_map[s] for s in data.get("skills", []) if s in skill_map]
        available_slots = [TimeSlot.from_dict(s) for s in data.get("available_slots", [])]
        return cls(
            id=data["id"],
            name=data["name"],
            phone=data["phone"],
            email=data.get("email", ""),
            skills=skills,
            available_slots=available_slots,
            max_hours_per_week=data.get("max_hours_per_week", 8.0),
            notes=data.get("notes", "")
        )


@dataclass
class Course:
    id: str
    name: str
    description: str
    time_slot: TimeSlot
    required_skills: List[SkillTag] = field(default_factory=list)
    min_volunteers: int = 1
    max_volunteers: int = 3
    location: str = ""
    teacher: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "time_slot": self.time_slot.to_dict(),
            "required_skills": [s.value for s in self.required_skills],
            "min_volunteers": self.min_volunteers,
            "max_volunteers": self.max_volunteers,
            "location": self.location,
            "teacher": self.teacher
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Course':
        skill_map = {s.value: s for s in SkillTag}
        required_skills = [skill_map[s] for s in data.get("required_skills", []) if s in skill_map]
        time_slot = TimeSlot.from_dict(data["time_slot"])
        return cls(
            id=data["id"],
            name=data["name"],
            description=data.get("description", ""),
            time_slot=time_slot,
            required_skills=required_skills,
            min_volunteers=data.get("min_volunteers", 1),
            max_volunteers=data.get("max_volunteers", 3),
            location=data.get("location", ""),
            teacher=data.get("teacher", "")
        )


@dataclass
class LeaveRequest:
    volunteer_id: str
    volunteer_name: str
    date: Optional[datetime] = None
    time_slot: Optional[TimeSlot] = None
    leave_type: LeaveType = LeaveType.OTHER
    reason: str = ""
    is_approved: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "volunteer_id": self.volunteer_id,
            "volunteer_name": self.volunteer_name,
            "date": self.date.strftime("%Y-%m-%d") if self.date else None,
            "time_slot": self.time_slot.to_dict() if self.time_slot else None,
            "leave_type": self.leave_type.value,
            "reason": self.reason,
            "is_approved": self.is_approved
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'LeaveRequest':
        date = datetime.strptime(data["date"], "%Y-%m-%d") if data.get("date") else None
        time_slot = TimeSlot.from_dict(data["time_slot"]) if data.get("time_slot") else None
        leave_type_map = {t.value: t for t in LeaveType}
        leave_type = leave_type_map.get(data.get("leave_type", "其他"), LeaveType.OTHER)
        return cls(
            volunteer_id=data["volunteer_id"],
            volunteer_name=data["volunteer_name"],
            date=date,
            time_slot=time_slot,
            leave_type=leave_type,
            reason=data.get("reason", ""),
            is_approved=data.get("is_approved", True)
        )


@dataclass
class SwapRequest:
    volunteer_id: str
    volunteer_name: str
    original_slot: TimeSlot
    target_slot: Optional[TimeSlot] = None
    swap_with_volunteer_id: Optional[str] = None
    swap_with_volunteer_name: Optional[str] = None
    reason: str = ""
    is_approved: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "volunteer_id": self.volunteer_id,
            "volunteer_name": self.volunteer_name,
            "original_slot": self.original_slot.to_dict(),
            "target_slot": self.target_slot.to_dict() if self.target_slot else None,
            "swap_with_volunteer_id": self.swap_with_volunteer_id,
            "swap_with_volunteer_name": self.swap_with_volunteer_name,
            "reason": self.reason,
            "is_approved": self.is_approved
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SwapRequest':
        original_slot = TimeSlot.from_dict(data["original_slot"])
        target_slot = TimeSlot.from_dict(data["target_slot"]) if data.get("target_slot") else None
        return cls(
            volunteer_id=data["volunteer_id"],
            volunteer_name=data["volunteer_name"],
            original_slot=original_slot,
            target_slot=target_slot,
            swap_with_volunteer_id=data.get("swap_with_volunteer_id"),
            swap_with_volunteer_name=data.get("swap_with_volunteer_name"),
            reason=data.get("reason", ""),
            is_approved=data.get("is_approved", False)
        )


@dataclass
class ScheduleAssignment:
    course_id: str
    course_name: str
    time_slot: TimeSlot
    volunteer_id: str
    volunteer_name: str
    assigned_skill: SkillTag
    is_confirmed: bool = True
    notes: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "course_id": self.course_id,
            "course_name": self.course_name,
            "time_slot": self.time_slot.to_dict(),
            "volunteer_id": self.volunteer_id,
            "volunteer_name": self.volunteer_name,
            "assigned_skill": self.assigned_skill.value,
            "is_confirmed": self.is_confirmed,
            "notes": self.notes
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ScheduleAssignment':
        skill_map = {s.value: s for s in SkillTag}
        assigned_skill = skill_map.get(data.get("assigned_skill", "助教"), SkillTag.ASSISTANT)
        time_slot = TimeSlot.from_dict(data["time_slot"])
        return cls(
            course_id=data["course_id"],
            course_name=data["course_name"],
            time_slot=time_slot,
            volunteer_id=data["volunteer_id"],
            volunteer_name=data["volunteer_name"],
            assigned_skill=assigned_skill,
            is_confirmed=data.get("is_confirmed", True),
            notes=data.get("notes", "")
        )


@dataclass
class Conflict:
    conflict_type: str
    description: str
    severity: str
    affected_volunteers: List[str] = field(default_factory=list)
    affected_courses: List[str] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "conflict_type": self.conflict_type,
            "description": self.description,
            "severity": self.severity,
            "affected_volunteers": self.affected_volunteers,
            "affected_courses": self.affected_courses,
            "details": self.details
        }


@dataclass
class Gap:
    gap_type: str
    description: str
    course_id: str
    course_name: str
    time_slot: TimeSlot
    required: int
    current: int
    missing_skills: List[SkillTag] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "gap_type": self.gap_type,
            "description": self.description,
            "course_id": self.course_id,
            "course_name": self.course_name,
            "time_slot": self.time_slot.to_dict(),
            "required": self.required,
            "current": self.current,
            "missing_skills": [s.value for s in self.missing_skills]
        }


@dataclass
class ScheduleResult:
    assignments: List[ScheduleAssignment] = field(default_factory=list)
    conflicts: List[Conflict] = field(default_factory=list)
    gaps: List[Gap] = field(default_factory=list)
    generated_at: datetime = field(default_factory=datetime.now)
    notes: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "assignments": [a.to_dict() for a in self.assignments],
            "conflicts": [c.to_dict() for c in self.conflicts],
            "gaps": [g.to_dict() for g in self.gaps],
            "generated_at": self.generated_at.isoformat(),
            "notes": self.notes
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ScheduleResult':
        assignments = [ScheduleAssignment.from_dict(a) for a in data.get("assignments", [])]
        conflicts = []
        for c in data.get("conflicts", []):
            conflicts.append(Conflict(
                conflict_type=c["conflict_type"],
                description=c["description"],
                severity=c["severity"],
                affected_volunteers=c.get("affected_volunteers", []),
                affected_courses=c.get("affected_courses", []),
                details=c.get("details", {})
            ))
        gaps = []
        skill_map = {s.value: s for s in SkillTag}
        for g in data.get("gaps", []):
            time_slot = TimeSlot.from_dict(g["time_slot"])
            missing_skills = [skill_map[s] for s in g.get("missing_skills", []) if s in skill_map]
            gaps.append(Gap(
                gap_type=g["gap_type"],
                description=g["description"],
                course_id=g["course_id"],
                course_name=g["course_name"],
                time_slot=time_slot,
                required=g["required"],
                current=g["current"],
                missing_skills=missing_skills
            ))
        generated_at = datetime.fromisoformat(data["generated_at"]) if data.get("generated_at") else datetime.now()
        return cls(
            assignments=assignments,
            conflicts=conflicts,
            gaps=gaps,
            generated_at=generated_at,
            notes=data.get("notes", "")
        )
