from enum import Enum


class LedgerStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    REJECTED = "rejected"
    SECONDARY_CONFIRMED = "secondary_confirmed"
    AUDIT_ONLY = "audit_only"


class DataSourceType(str, Enum):
    SUPPLIER_DELIVERY = "supplier_delivery"
    WEIGHING_RECORD = "weighing_record"
    BASKET_RETURN_PHOTO = "basket_return_photo"
    SECONDARY_CONFIRMATION = "secondary_confirmation"


class UserRole(str, Enum):
    SORTER = "sorter"
    SUPERVISOR = "supervisor"
    PROCUREMENT_MANAGER = "procurement_manager"
    AUDITOR = "auditor"
    ADMIN = "admin"


class LossType(str, Enum):
    BAD_FRUIT = "bad_fruit"
    SECONDARY_SORTING = "secondary_sorting"
    TRANSPORT_DAMAGE = "transport_damage"
    OTHER = "other"


class RecordStatus(str, Enum):
    VALID = "valid"
    INVALID = "invalid"
    DUPLICATE = "duplicate"
