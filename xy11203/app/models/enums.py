from enum import Enum


class MedicineType(str, Enum):
    VACCINE = "vaccine"
    INSULIN = "insulin"
    OTHER = "other"


class BatchStatus(str, Enum):
    PENDING = "pending"
    RECEIVED = "received"
    ISOLATED = "isolated"
    REVIEWING = "reviewing"
    APPROVED = "approved"
    RELEASED = "released"
    RETURNED = "returned"
    REJECTED = "rejected"


class OperationType(str, Enum):
    RECEIVE = "receive"
    ISOLATE = "isolate"
    REVIEW = "review"
    APPROVE = "approve"
    RELEASE = "release"
    RETURN = "return"
    REJECT = "reject"
    IMPORT = "import"
    EXPORT = "export"
    UPDATE = "update"


class RuleType(str, Enum):
    TEMPERATURE = "temperature"
    BATCH_DUPLICATE = "batch_duplicate"
    MISSING_PHOTO = "missing_photo"
    INVENTORY_CHANGE = "inventory_change"
    EXPIRY_DATE = "expiry_date"
    DAMAGE = "damage"


class RuleResultStatus(str, Enum):
    PASSED = "passed"
    BLOCKED = "blocked"
    WARNING = "warning"


class UserRole(str, Enum):
    ADMIN = "admin"
    WAREHOUSE_KEEPER = "warehouse_keeper"
    REVIEWER = "reviewer"
    VIEWER = "viewer"
