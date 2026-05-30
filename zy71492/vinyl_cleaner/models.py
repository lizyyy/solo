import uuid
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


def generate_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


class SourceType(str, Enum):
    VINYL_RECORD = "vinyl_record"
    CUSTOMER = "customer"
    CLEANING_RECORD = "cleaning_record"
    SCRATCH = "scratch"
    LISTENING_TEST = "listening_test"


class CleaningStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    CLEANED = "cleaned"
    NEEDS_RECLEAN = "needs_reclean"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ScratchSeverity(str, Enum):
    LIGHT = "light"
    MODERATE = "moderate"
    HEAVY = "heavy"
    UNPLAYABLE = "unplayable"


class ListeningResult(str, Enum):
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"
    UNTESTED = "untested"


class Source(BaseModel):
    source_id: str
    source_type: SourceType
    file_name: str
    imported_at: datetime = Field(default_factory=datetime.now)
    imported_by: Optional[str] = None
    raw_data: Dict[str, Any]


class Customer(BaseModel):
    customer_id: str
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    source_id: str
    created_at: datetime = Field(default_factory=datetime.now)


class PhotoReference(BaseModel):
    photo_id: str
    file_path: str
    description: str
    taken_at: datetime
    source_id: str


class ScratchRecord(BaseModel):
    scratch_id: str
    record_id: str
    location: str
    severity: ScratchSeverity
    description: str
    side: Optional[str] = None
    track: Optional[str] = None
    photo_ids: List[str] = Field(default_factory=list)
    source_id: str
    recorded_at: datetime = Field(default_factory=datetime.now)


class ListeningTest(BaseModel):
    test_id: str
    record_id: str
    side: str
    result: ListeningResult
    crackle: int
    surface_noise: int
    pops: int
    distortion: int
    overall_score: Optional[float] = None
    notes: Optional[str] = None
    tested_by: Optional[str] = None
    source_id: str
    tested_at: datetime = Field(default_factory=datetime.now)


class CleaningStep(BaseModel):
    step_name: str
    duration_seconds: Optional[int] = None
    notes: Optional[str] = None
    completed: bool = False
    completed_at: Optional[datetime] = None


class CleaningRecord(BaseModel):
    cleaning_id: str
    record_id: str
    sequence: int
    status: CleaningStatus
    cleaning_agent: Optional[str] = None
    brush_type: Optional[str] = None
    machine: Optional[str] = None
    steps: List[CleaningStep] = Field(default_factory=list)
    photo_before: List[str] = Field(default_factory=list)
    photo_after: List[str] = Field(default_factory=list)
    notes: Optional[str] = None
    performed_by: Optional[str] = None
    source_id: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class VinylRecord(BaseModel):
    record_id: str
    catalog_number: str
    artist: Optional[str] = None
    album_title: Optional[str] = None
    customer_id: Optional[str] = None
    status: CleaningStatus = CleaningStatus.PENDING
    scratches: List[str] = Field(default_factory=list)
    listening_tests: List[str] = Field(default_factory=list)
    cleaning_records: List[str] = Field(default_factory=list)
    photos: List[str] = Field(default_factory=list)
    total_cleanings: int = 0
    source_id: str
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class ConflictType(str, Enum):
    DUPLICATE_RECORD_ID = "duplicate_record_id"
    DUPLICATE_CATALOG_NUMBER = "duplicate_catalog_number"
    SCRATCH_OVERLAP = "scratch_overlap"
    MISSING_LISTENING_TEST = "missing_listening_test"
    MISSING_CUSTOMER = "missing_customer"
    INVALID_STATUS_TRANSITION = "invalid_status_transition"


class Conflict(BaseModel):
    conflict_id: str
    conflict_type: ConflictType
    record_id: Optional[str] = None
    source_ids: List[str]
    message: str
    details: Dict[str, Any] = Field(default_factory=dict)
    resolved: bool = False
    resolution: Optional[str] = None
    detected_at: datetime = Field(default_factory=datetime.now)


class DatabaseState(BaseModel):
    sources: Dict[str, Source] = Field(default_factory=dict)
    customers: Dict[str, Customer] = Field(default_factory=dict)
    vinyl_records: Dict[str, VinylRecord] = Field(default_factory=dict)
    scratches: Dict[str, ScratchRecord] = Field(default_factory=dict)
    listening_tests: Dict[str, ListeningTest] = Field(default_factory=dict)
    cleaning_records: Dict[str, CleaningRecord] = Field(default_factory=dict)
    photos: Dict[str, PhotoReference] = Field(default_factory=dict)
    conflicts: List[Conflict] = Field(default_factory=list)
