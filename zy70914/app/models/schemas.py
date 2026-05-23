from enum import Enum
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ReviewStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEED_MORE_INFO = "need_more_info"
    RECALCULATED = "recalculated"


class DiscrepancyType(str, Enum):
    OVERTIME_DECLARATION = "overtime_declaration"
    RESPONSIBLE_SEGMENT = "responsible_segment"
    COMPENSATION_LIMIT = "compensation_limit"
    MISSING_PHOTO = "missing_photo"
    FLIGHT_MISMATCH = "flight_mismatch"
    AMOUNT_MISMATCH = "amount_mismatch"
    INVALID_DOCUMENT = "invalid_document"
    DUPLICATE_CLAIM = "duplicate_claim"


class DiscrepancyItem(BaseModel):
    type: DiscrepancyType
    severity: str
    field: Optional[str] = None
    expected: Optional[Any] = None
    actual: Optional[Any] = None
    description: str
    suggestion: Optional[str] = None


class ClaimRecord(BaseModel):
    claim_id: str
    passenger_name: str
    id_card: str
    phone: str
    flight_no: str
    flight_date: date
    segment: str
    claim_type: str
    claim_amount: float
    declaration_time: datetime
    incident_description: str
    photo_ids: List[str] = Field(default_factory=list)
    remarks: Optional[str] = None
    raw_data: Dict[str, Any] = Field(default_factory=dict)
