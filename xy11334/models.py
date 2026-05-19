from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List
from uuid import uuid4


class TaskStatus(Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"


class TaskPriority(Enum):
    NORMAL = "normal"
    EMERGENCY = "emergency"


class ActionType(Enum):
    CREATE = "create"
    ASSIGN = "assign"
    ACCEPT = "accept"
    CANCEL = "cancel"
    TIMEOUT = "timeout"
    REASSIGN = "reassign"
    JUMP_QUEUE = "jump_queue"
    COMPLETE = "complete"


@dataclass
class Patient:
    id: str
    name: str
    phone: str
    id_card: str
    department: str
    is_emergency: bool = False

    def to_dict(self, desensitize: bool = False) -> dict:
        data = {
            "id": self.id,
            "name": self._desensitize_name(self.name) if desensitize else self.name,
            "phone": self._desensitize_phone(self.phone) if desensitize else self.phone,
            "id_card": self._desensitize_id_card(self.id_card) if desensitize else self.id_card,
            "department": self.department,
            "is_emergency": self.is_emergency
        }
        return data

    @staticmethod
    def _desensitize_name(name: str) -> str:
        if len(name) <= 1:
            return "*"
        return name[0] + "*" * (len(name) - 1)

    @staticmethod
    def _desensitize_phone(phone: str) -> str:
        if len(phone) < 7:
            return "*" * len(phone)
        return phone[:3] + "*" * 4 + phone[-4:]

    @staticmethod
    def _desensitize_id_card(id_card: str) -> str:
        if len(id_card) < 8:
            return "*" * len(id_card)
        return id_card[:6] + "*" * 8 + id_card[-4:]


@dataclass
class Escort:
    id: str
    name: str
    phone: str
    employee_id: str
    is_active: bool = True

    def to_dict(self, desensitize: bool = False) -> dict:
        data = {
            "id": self.id,
            "name": self.name,
            "phone": self._desensitize_phone(self.phone) if desensitize else self.phone,
            "employee_id": self.employee_id,
            "is_active": self.is_active
        }
        return data

    @staticmethod
    def _desensitize_phone(phone: str) -> str:
        if len(phone) < 7:
            return "*" * len(phone)
        return phone[:3] + "*" * 4 + phone[-4:]


@dataclass
class ActionLog:
    id: str
    task_id: str
    action_type: ActionType
    operator: str
    timestamp: datetime
    reason: str
    from_escort_id: Optional[str] = None
    to_escort_id: Optional[str] = None
    success: bool = True

    def to_dict(self, desensitize: bool = False) -> dict:
        return {
            "id": self.id,
            "task_id": self.task_id,
            "action_type": self.action_type.value,
            "operator": self.operator,
            "timestamp": self.timestamp.isoformat(),
            "reason": self.reason,
            "from_escort_id": self.from_escort_id,
            "to_escort_id": self.to_escort_id,
            "success": self.success
        }


@dataclass
class Task:
    id: str
    patient: Patient
    priority: TaskPriority
    status: TaskStatus
    created_at: datetime
    escort: Optional[Escort] = None
    accepted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    timeout_minutes: int = 30
    position: int = 0
    action_logs: List[ActionLog] = field(default_factory=list)

    def is_timeout(self) -> bool:
        if self.status != TaskStatus.PENDING or not self.created_at:
            return False
        elapsed = (datetime.now() - self.created_at).total_seconds() / 60
        return elapsed > self.timeout_minutes

    def to_dict(self, desensitize: bool = False) -> dict:
        return {
            "id": self.id,
            "patient": self.patient.to_dict(desensitize),
            "priority": self.priority.value,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "escort": self.escort.to_dict(desensitize) if self.escort else None,
            "accepted_at": self.accepted_at.isoformat() if self.accepted_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "timeout_minutes": self.timeout_minutes,
            "position": self.position,
            "action_logs": [log.to_dict(desensitize) for log in self.action_logs]
        }


@dataclass
class RuleResult:
    passed: bool
    reason: str
    rule_name: str
