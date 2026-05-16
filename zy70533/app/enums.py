from enum import Enum


class FreezeStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    BLOCKED = "blocked"
    REVOKED = "revoked"
    COMPENSATED = "compensated"


class ChangeType(str, Enum):
    PARAMETER_MODIFY = "parameter_modify"
    METRIC_WINDOW_ADJUST = "metric_window_adjust"
    EXPERIMENT_EXTEND = "experiment_extend"
    OTHER = "other"


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ExceptionType(str, Enum):
    PARAMETER_MISMATCH = "parameter_mismatch"
    METRIC_ANOMALY = "metric_anomaly"
    TIMEOUT = "timeout"
    DATA_INCONSISTENCY = "data_inconsistency"
    USER_OPERATION_ERROR = "user_operation_error"
    SYSTEM_ERROR = "system_error"
