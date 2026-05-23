from enum import Enum
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
import pandas as pd
import json
import uuid
from io import StringIO


class ReviewStatus(str, Enum):
    PENDING = 'pending'
    APPROVED = 'approved'
    REJECTED = 'rejected'
    NEED_MORE_INFO = 'need_more_info'
    RECALCULATED = 'recalculated'


class DiscrepancyType(str, Enum):
    OVERTIME_DECLARATION = 'overtime_declaration'
    RESPONSIBLE_SEGMENT = 'responsible_segment'
    COMPENSATION_LIMIT = 'compensation_limit'
    MISSING_PHOTO = 'missing_photo'
    FLIGHT_MISMATCH = 'flight_mismatch'
    AMOUNT_MISMATCH = 'amount_mismatch'
    INVALID_DOCUMENT = 'invalid_document'
    DUPLICATE_CLAIM = 'duplicate_claim'


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

class FlightInfo(BaseModel):
    flight_no: str
    flight_date: date
    departure: str
    arrival: str
    scheduled_departure: Optional[datetime] = None
    actual_departure: Optional[datetime] = None
    scheduled_arrival: Optional[datetime] = None
    actual_arrival: Optional[datetime] = None
    aircraft_type: Optional[str] = None
    is_canceled: bool = False
    is_diverted: bool = False
    responsible_airline: Optional[str] = None
    delay_minutes: int = 0
    reason_code: Optional[str] = None
    raw_data: Dict[str, Any] = Field(default_factory=dict)

class PhotoIndex(BaseModel):
    photo_id: str
    claim_id: str
    file_name: str
    file_path: str
    upload_time: datetime
    photo_type: str
    is_valid: bool = True
    ocr_text: Optional[str] = None

class CompensationRule(BaseModel):
    rule_id: str
    rule_name: str
    claim_type: str
    flight_type: str
    min_delay_minutes: int = 0
    max_delay_minutes: Optional[int] = None
    compensation_amount: float
    max_compensation: Optional[float] = None
    valid_from: date
    valid_to: Optional[date] = None
    description: str
    conditions: Dict[str, Any] = Field(default_factory=dict)

class ReviewRecord(BaseModel):
    claim_id: str
    reviewer: str
    review_time: datetime
    status: ReviewStatus
    reviewed_amount: float
    review_notes: str
    adjustment_reason: Optional[str] = None
    previous_status: Optional[ReviewStatus] = None
    previous_amount: Optional[float] = None

class ReconciliationSummary(BaseModel):
    batch_id: str
    total_claims: int = 0
    approved_count: int = 0
    rejected_count: int = 0
    pending_count: int = 0
    need_more_info_count: int = 0
    total_claimed_amount: float = 0.0
    total_approved_amount: float = 0.0
    total_suggested_amount: float = 0.0
    discrepancy_breakdown: Dict[str, int] = Field(default_factory=dict)
    generated_at: datetime = Field(default_factory=datetime.now)
    generated_by: str = "system"


class ComparisonResult(BaseModel):
    claim_id: str
    flight_no: str
    flight_date: date
    auto_status: ReviewStatus = ReviewStatus.PENDING
    suggested_amount: float = 0.0
    claimed_amount: float = 0.0
    final_amount: float = 0.0
    discrepancies: List[DiscrepancyItem] = Field(default_factory=list)
    matched_flight: Optional[FlightInfo] = None
    matched_photos: List[PhotoIndex] = Field(default_factory=list)
    applicable_rules: List[CompensationRule] = Field(default_factory=list)
    explanation: str = chr(34) + chr(34) + chr(34) + chr(34)
    review_record: Optional[ReviewRecord] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

