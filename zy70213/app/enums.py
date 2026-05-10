from enum import Enum


class Season(str, Enum):
    SPRING = "spring"
    SUMMER = "summer"
    AUTUMN = "autumn"
    WINTER = "winter"

    @classmethod
    def from_month(cls, month: int) -> "Season":
        if 3 <= month <= 5:
            return cls.SPRING
        elif 6 <= month <= 8:
            return cls.SUMMER
        elif 9 <= month <= 11:
            return cls.AUTUMN
        else:
            return cls.WINTER


class AnimalStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    PENDING = "pending"
    SUSPENDED = "suspended"


class AnimalHealth(str, Enum):
    HEALTHY = "healthy"
    MILD = "mild"
    MODERATE = "moderate"
    SEVERE = "severe"
    CRITICAL = "critical"


class DailyRationStatus(str, Enum):
    DRAFT = "draft"
    VALIDATING = "validating"
    PENDING = "pending"
    CONFIRMED = "confirmed"
    EXECUTED = "executed"
    FAILED = "failed"
    CANCELLED = "cancelled"

    @classmethod
    def allowed_transitions(cls) -> dict["DailyRationStatus", list["DailyRationStatus"]]:
        return {
            cls.DRAFT: [cls.VALIDATING],
            cls.VALIDATING: [cls.PENDING, cls.FAILED],
            cls.PENDING: [cls.CONFIRMED, cls.FAILED, cls.DRAFT],
            cls.CONFIRMED: [cls.EXECUTED, cls.CANCELLED],
            cls.FAILED: [cls.DRAFT, cls.VALIDATING],
        }

    def can_transition_to(self, target: "DailyRationStatus") -> bool:
        allowed = self.allowed_transitions().get(self, [])
        return target in allowed
