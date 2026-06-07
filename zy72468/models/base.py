from datetime import datetime
from enum import Enum
from pydantic import BaseModel as PydanticBaseModel, Field
import uuid


class RecordStatus(str, Enum):
    DRAFT = "draft"
    IMPORTED = "imported"
    SUPPLEMENTED = "supplemented"
    CONFLICT_DETECTED = "conflict_detected"
    PENDING_REVIEW = "pending_review"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    FINALIZED = "finalized"


class ConflictStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED_BY_PLANNER = "confirmed_by_planner"
    REJECTED_BY_PLANNER = "rejected_by_planner"
    RESOLVED = "resolved"


class ReviewStatus(str, Enum):
    NOT_REQUIRED = "not_required"
    PENDING_RESIDENT_REVIEW = "pending_resident_review"
    APPROVED_BY_RESIDENT = "approved_by_resident"
    REJECTED_BY_RESIDENT = "rejected_by_resident"


class UserRole(str, Enum):
    PLANNER = "planner"
    RESIDENT_REP = "resident_rep"
    SYSTEM = "system"


class BaseModel(PydanticBaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    created_by: str
    updated_by: str

    def touch(self, operator: str):
        self.updated_at = datetime.now()
        self.updated_by = operator
