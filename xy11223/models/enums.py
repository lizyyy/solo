from enum import Enum


class RecordStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    ISOLATED = "isolated"


class ExceptionType(str, Enum):
    EXPIRED_SAMPLE = "expired_sample"
    TEMPERATURE_GAP = "temperature_gap"
    TEMPERATURE_HIGH = "temperature_high"
    TEMPERATURE_LOW = "temperature_low"
    WASTE_DELAYED = "waste_delayed"
    DUPLICATE_RECORD = "duplicate_record"
    MISSING_DATA = "missing_data"
    BATCH_INCONSISTENCY = "batch_inconsistency"


class ReviewStatus(str, Enum):
    UNREVIEWED = "unreviewed"
    REVIEWING = "reviewing"
    REVIEWED = "reviewed"
    APPEALED = "appealed"


class OperationStatus(str, Enum):
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"
    PENDING = "pending"


class SampleType(str, Enum):
    COOKED = "cooked"
    RAW = "raw"
    SEMI_FINISHED = "semi_finished"
    SAUCE = "sauce"
