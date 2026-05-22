from enum import Enum


class RecordStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    REJECTED = "rejected"
    CONFIRMED = "confirmed"
    FROZEN = "frozen"
    ARCHIVED = "archived"


class UserRole(str, Enum):
    PHARMACY_MANAGER = "pharmacy_manager"
    TOWN_SUPERVISOR = "town_supervisor"
    REGIONAL_SUPERVISOR = "regional_supervisor"
    AUDITOR = "auditor"
    ADMIN = "admin"


class ChangeType(str, Enum):
    CREATE = "create"
    SUBMIT = "submit"
    REJECT = "reject"
    CONFIRM = "confirm"
    MODIFY = "modify"
    REVISE = "revise"
    FREEZE = "freeze"
    UNFREEZE = "unfreeze"
    ARCHIVE = "archive"
    WITHDRAW = "withdraw"
    IMPORT = "import"
    EXPORT = "export"


class ImportSourceType(str, Enum):
    INVENTORY_EXPORT = "inventory_export"
    MANUAL_TRANSFER = "manual_transfer"
    RETURN_PHOTO = "return_photo"
    HISTORY_ARCHIVE = "history_archive"


class LiabilityResult(str, Enum):
    PENDING = "pending"
    NO_LIABILITY = "no_liability"
    STORE_LIABILITY = "store_liability"
    SUPPLIER_LIABILITY = "supplier_liability"
    TRANSFER_ERROR = "transfer_error"
    REVISED = "revised"


class ExitCode(int, Enum):
    SUCCESS = 0
    ERROR = 1
    VALIDATION_ERROR = 2
    NOT_FOUND = 3
    DUPLICATE = 4
    PERMISSION_DENIED = 5
    INVALID_STATE = 6
    PARTIAL_FAILURE = 7
