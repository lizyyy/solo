from enum import Enum


class BatchStatus(str, Enum):
    DRAFT = "draft"
    CREATED = "created"
    MATERIALS_UPLOADED = "materials_uploaded"
    UNDER_REVIEW = "under_review"
    REVIEW_PASSED = "review_passed"
    REVIEW_REJECTED = "review_rejected"
    FROZEN = "frozen"
    SETTLED = "settled"
    ARCHIVED = "archived"
    CANCELLED = "cancelled"


class MaterialType(str, Enum):
    VISITOR_APPOINTMENT = "visitor_appointment"
    GATE_RECORD = "gate_record"
    LICENSE_PLATE_SCREENSHOT = "license_plate_screenshot"
    MANUAL_PRICE_ADJUSTMENT = "manual_price_adjustment"
    HISTORY_ARCHIVE = "history_archive"


class IdempotencyStrategy(str, Enum):
    IGNORE = "ignore"
    OVERWRITE = "overwrite"
    APPEND = "append"


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    WAITING_RETRY = "waiting_retry"
    WAITING_MANUAL = "waiting_manual"
    FAILED_PERMANENTLY = "failed_permanently"


class TaskType(str, Enum):
    PARSE_MATERIAL = "parse_material"
    VALIDATE_DATA = "validate_data"
    GENERATE_REPORT = "generate_report"
    EXPORT_DATA = "export_data"
    ARCHIVE_BATCH = "archive_batch"


class ReviewResult(str, Enum):
    PASS = "pass"
    REJECT = "reject"
    NEED_MORE_INFO = "need_more_info"
