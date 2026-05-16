from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Dict, Any, List
from enum import Enum

class EntryStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    ROLLED_BACK = "rolled_back"
    NEEDS_REVIEW = "needs_review"
    MANUALLY_FIXED = "manually_fixed"

class ConflictType(str, Enum):
    NONE = "none"
    DUPLICATE_VERSION = "duplicate_version"
    SOURCE_CHANGED = "source_changed"
    TARGET_CONFLICT = "target_conflict"
    HISTORY_MISMATCH = "history_mismatch"

class TranslationEntryCreate(BaseModel):
    entry_key: str = Field(..., max_length=500)
    source_language: str = Field(..., max_length=50)
    target_language: str = Field(..., max_length=50)
    source_text: str
    target_text: str
    version_batch: str = Field(..., max_length=100)
    created_by: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class TranslationEntryResponse(BaseModel):
    id: int
    entry_key: str
    source_language: str
    target_language: str
    source_text: str
    target_text: str
    version_batch: str
    version_number: int
    status: EntryStatus
    rollback_reason: Optional[str]
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str]
    metadata: Optional[Dict[str, Any]]
    
    class Config:
        orm_mode = True

class StatusUpdateRequest(BaseModel):
    new_status: EntryStatus
    rollback_reason: Optional[str] = None
    updated_by: Optional[str] = None

class ManualFixRequest(BaseModel):
    new_source_text: Optional[str] = None
    new_target_text: Optional[str] = None
    fix_notes: str
    fixed_by: Optional[str] = None

class ReportResponse(BaseModel):
    id: int
    entry_id: int
    report_type: str
    conflict_type: ConflictType
    original_input: Dict[str, Any]
    processing_result: Dict[str, Any]
    conclusion: str
    severity: str
    detected_at: datetime
    resolved_at: Optional[datetime]
    resolved_by: Optional[str]
    resolution_notes: Optional[str]
    
    class Config:
        orm_mode = True

class ExportRequest(BaseModel):
    version_batch: Optional[str] = None
    source_language: Optional[str] = None
    target_language: Optional[str] = None
    status: Optional[EntryStatus] = None
    include_reports: bool = True

class ExportResponse(BaseModel):
    entries: List[TranslationEntryResponse]
    reports: List[ReportResponse]
    export_time: datetime
    total_entries: int
    total_reports: int

class QueryParams(BaseModel):
    entry_key: Optional[str] = None
    source_language: Optional[str] = None
    target_language: Optional[str] = None
    version_batch: Optional[str] = None
    status: Optional[EntryStatus] = None
    skip: int = 0
    limit: int = 100

class IdempotentResponse(BaseModel):
    is_duplicate: bool
    existing_entry: Optional[TranslationEntryResponse]
    message: str

class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Dict[str, Any]
    timestamp: datetime