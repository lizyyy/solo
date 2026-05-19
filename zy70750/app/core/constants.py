from enum import Enum


class ErrorCode(str, Enum):
    MISSING_FIELD = "missing_field"
    INVALID_STATUS = "invalid_status"
    NEED_MANUAL_REVIEW = "need_manual_review"
    ALREADY_PROCESSED = "already_processed"
    NOT_FOUND = "not_found"
    VALIDATION_ERROR = "validation_error"


class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    NEED_REVIEW = "need_review"
    REVIEWED = "reviewed"


class DiffType(str, Enum):
    MISSING_MASK = "missing_mask"
    OVER_MASK = "over_mask"
    NEW_FIELD = "new_field"
    CONTENT_CHANGE = "content_change"
