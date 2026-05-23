from enum import Enum


class DataSource(str, Enum):
    PILE_ALARM = "pile_alarm"
    INSPECTION_FORM = "inspection_form"
    CUSTOMER_COMPLAINT = "customer_complaint"
    MANUAL_SUPPLEMENT = "manual_supplement"


class BatchStrategy(str, Enum):
    IGNORE = "ignore"
    OVERWRITE = "overwrite"
    APPEND = "append"


class WorkOrderStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    PENDING_REVIEW = "pending_review"
    REVIEWED = "reviewed"
    FROZEN = "frozen"
    ARCHIVED = "archived"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    WAITING_RETRY = "waiting_retry"
    WAITING_MANUAL = "waiting_manual"
    PERMANENT_FAILED = "permanent_failed"
    COMPLETED = "completed"


class TaskType(str, Enum):
    BATCH_IMPORT = "batch_import"
    STATUS_TRANSITION = "status_transition"
    EXPORT_REPORT = "export_report"
    DATA_SYNC = "data_sync"


class OperationType(str, Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    STATUS_CHANGE = "status_change"
    ATTACHMENT_UPLOAD = "attachment_upload"
    REVIEW = "review"
    FREEZE = "freeze"
    UNFREEZE = "unfreeze"
    ARCHIVE = "archive"
    WITHDRAW = "withdraw"
