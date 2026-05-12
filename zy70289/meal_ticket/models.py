from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional, List
import uuid
from enum import Enum


class ShiftType(Enum):
    MORNING = "早班"
    AFTERNOON = "中班"
    EVENING = "晚班"
    NIGHT = "夜班"


class MealType(Enum):
    BREAKFAST = "早餐"
    LUNCH = "午餐"
    DINNER = "晚餐"
    MIDNIGHT_SNACK = "夜宵"


class PositionType(Enum):
    REGISTRATION = "签到组"
    SECURITY = "安保组"
    GUIDE = "引导组"
    SERVICE = "服务组"
    TECHNICAL = "技术组"
    MEDICAL = "医疗组"


class TicketStatus(Enum):
    UNUSED = "未使用"
    USED = "已使用"
    VOID = "已作废"


class ValidationStatus(Enum):
    NORMAL = "正常"
    DUPLICATE = "重复核销"
    MISSING = "漏发"
    INVALID_SHIFT = "班次不符"
    INVALID_MEAL = "餐点不符"
    EXPIRED = "已过期"


@dataclass
class Volunteer:
    id: str
    name: str
    phone: str
    position: PositionType
    shift: ShiftType
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    
    def to_dict(self):
        data = asdict(self)
        data["position"] = self.position.value
        data["shift"] = self.shift.value
        return data
    
    @classmethod
    def from_dict(cls, data):
        return cls(
            id=data["id"],
            name=data["name"],
            phone=data["phone"],
            position=PositionType(data["position"]),
            shift=ShiftType(data["shift"]),
            created_at=data.get("created_at", datetime.now().isoformat())
        )


@dataclass
class MealTicket:
    id: str
    volunteer_id: str
    meal_type: MealType
    shift: ShiftType
    position: PositionType
    status: TicketStatus = TicketStatus.UNUSED
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    used_at: Optional[str] = None
    
    def to_dict(self):
        data = asdict(self)
        data["meal_type"] = self.meal_type.value
        data["shift"] = self.shift.value
        data["position"] = self.position.value
        data["status"] = self.status.value
        return data
    
    @classmethod
    def from_dict(cls, data):
        return cls(
            id=data["id"],
            volunteer_id=data["volunteer_id"],
            meal_type=MealType(data["meal_type"]),
            shift=ShiftType(data["shift"]),
            position=PositionType(data["position"]),
            status=TicketStatus(data["status"]),
            created_at=data.get("created_at", datetime.now().isoformat()),
            used_at=data.get("used_at")
        )


@dataclass
class ValidationRecord:
    id: str
    ticket_id: str
    volunteer_id: str
    volunteer_name: str
    position: PositionType
    shift: ShiftType
    meal_type: MealType
    validation_time: str
    validation_status: ValidationStatus
    details: str = ""
    
    def to_dict(self):
        data = asdict(self)
        data["position"] = self.position.value
        data["shift"] = self.shift.value
        data["meal_type"] = self.meal_type.value
        data["validation_status"] = self.validation_status.value
        return data
    
    @classmethod
    def from_dict(cls, data):
        return cls(
            id=data["id"],
            ticket_id=data["ticket_id"],
            volunteer_id=data["volunteer_id"],
            volunteer_name=data["volunteer_name"],
            position=PositionType(data["position"]),
            shift=ShiftType(data["shift"]),
            meal_type=MealType(data["meal_type"]),
            validation_time=data["validation_time"],
            validation_status=ValidationStatus(data["validation_status"]),
            details=data.get("details", "")
        )


@dataclass
class Database:
    volunteers: List[Volunteer] = field(default_factory=list)
    tickets: List[MealTicket] = field(default_factory=list)
    validations: List[ValidationRecord] = field(default_factory=list)
    
    def to_dict(self):
        return {
            "volunteers": [v.to_dict() for v in self.volunteers],
            "tickets": [t.to_dict() for t in self.tickets],
            "validations": [v.to_dict() for v in self.validations]
        }
    
    @classmethod
    def from_dict(cls, data):
        return cls(
            volunteers=[Volunteer.from_dict(v) for v in data.get("volunteers", [])],
            tickets=[MealTicket.from_dict(t) for t in data.get("tickets", [])],
            validations=[ValidationRecord.from_dict(v) for v in data.get("validations", [])]
        )
