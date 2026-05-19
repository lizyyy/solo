from enum import Enum

class RecordStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    PARTIAL = "partial"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class AnomalyType(str, Enum):
    QUANTITY_MISMATCH = "quantity_mismatch"
    MATERIAL_NOT_FOUND = "material_not_found"
    DUPLICATE_RECORD = "duplicate_record"
    INVALID_STATUS = "invalid_status"
    DATE_CONFLICT = "date_conflict"
    INSUFFICIENT_STOCK = "insufficient_stock"
    UNKNOWN_MATERIAL = "unknown_material"
    INVALID_DATA = "invalid_data"
    MISSING_FIELD = "missing_field"

class MaterialType(str, Enum):
    TRUSS = "truss"
    LIGHT = "light"
    SCREEN = "screen"
    OTHER = "other"
