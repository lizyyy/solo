from enum import Enum


class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    WAITING_RETRY = "waiting_retry"
    WAITING_MANUAL = "waiting_manual"
    PERMANENT_FAILED = "permanent_failed"
    COMPENSATED = "compensated"
    CLOSED = "closed"


class TaskSource(str, Enum):
    DRIVER_PHOTO = "driver_photo"
    WMS_BOX = "wms_box"
    TEMPERATURE_RECORD = "temperature_record"
    INVENTORY_DIFF = "inventory_diff"


class RetryCategory(str, Enum):
    NETWORK_ERROR = "network_error"
    DATA_INCOMPLETE = "data_incomplete"
    CROSS_DAY_SIGN = "cross_day_sign"
    BOX_RENAME = "box_rename"
    RECEIPT_DELAYED = "receipt_delayed"
    OTHER = "other"


class OperationType(str, Enum):
    SUBMIT = "submit"
    PROCESS = "process"
    RETRY = "retry"
    MANUAL_TAKE_OVER = "manual_take_over"
    COMPENSATE = "compensate"
    CLOSE = "close"
