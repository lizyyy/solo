from enum import Enum


class Role(str, Enum):
    ADMIN = "admin"
    DISPATCHER = "dispatcher"
    ESCORT = "escort"


class TaskStatus(str, Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    ACCEPTED = "accepted"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"


class TaskPriority(str, Enum):
    NORMAL = "normal"
    URGENT = "urgent"
    EMERGENCY = "emergency"


class ExceptionType(str, Enum):
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"
    TRANSFER_FAILED = "transfer_failed"
    ACCEPT_FAILED = "accept_failed"
    DUPLICATE_OPERATION = "duplicate_operation"
    OTHER = "other"


class OperationType(str, Enum):
    CREATE = "create"
    ASSIGN = "assign"
    ACCEPT = "accept"
    TRANSFER = "transfer"
    COMPLETE = "complete"
    CANCEL = "cancel"
    TIMEOUT = "timeout"
    UPDATE_PRIORITY = "update_priority"
