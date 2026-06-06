from enum import Enum


class ProcessingStatus(str, Enum):
    IMPORTED = "imported"
    MANUAL_REVIEW_PENDING = "manual_review_pending"
    LIN_TEACHER_REVIEWED = "lin_teacher_reviewed"
    COACH_REVIEW_PENDING = "coach_review_pending"
    COACH_APPROVED = "coach_approved"
    REPORT_UPDATED = "report_updated"
    ROLLBACKED = "rollbacked"


class TemperatureUnit(str, Enum):
    CELSIUS = "C"
    KELVIN = "K"
    UNKNOWN = "unknown"
    MIXED = "mixed"


class UserRole(str, Enum):
    LIN_TEACHER = "lin_teacher"
    COACH = "coach"
    OPERATOR = "operator"


class ChangeType(str, Enum):
    IMPORT = "import"
    MANUAL_EDIT = "manual_edit"
    STATUS_CHANGE = "status_change"
    TEMPERATURE_UNIT_FIX = "temperature_unit_fix"
    ROLLBACK = "rollback"
    REMARK_ADD = "remark_add"
