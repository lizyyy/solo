from datetime import datetime
from enum import Enum
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field


class PathStatus(str, Enum):
    SUCCESS = "success"
    FAILED = "failed"
    CONFLICT = "conflict"
    SKIPPED = "skipped"
    MANUAL_FIX = "manual_fix"


class IssueType(str, Enum):
    PERMISSION_OVER_GRANT = "permission_over_grant"
    PATH_MISMATCH = "path_mismatch"
    CROSS_DAY_BOUNDARY = "cross_day_boundary"
    MISSING_DATA = "missing_data"
    FORMAT_ERROR = "format_error"
    DUPLICATE_RECORD = "duplicate_record"


class PathRecord(BaseModel):
    record_id: str
    batch_id: str
    source: str
    recording_id: str
    agent_id: str
    customer_id: str
    start_time: datetime
    end_time: datetime
    permission_path: List[str]
    actual_path: List[str]
    merged_path: Optional[List[str]] = None
    status: PathStatus = PathStatus.SUCCESS
    issues: List[Dict[str, Any]] = Field(default_factory=list)
    is_manual_fix: bool = False
    fix_reason: Optional[str] = None
    fix_time: Optional[datetime] = None
    processed_time: Optional[datetime] = None
    execution_time_ms: float = 0.0
    metadata: Dict[str, Any] = Field(default_factory=dict)


class MergeResult(BaseModel):
    batch_id: str
    total_records: int
    success_count: int
    failed_count: int
    conflict_count: int
    skipped_count: int
    manual_fix_count: int
    execution_time_ms: float
    start_time: datetime
    end_time: datetime
    records: List[PathRecord]
    suggestions: List[str] = Field(default_factory=list)


class CacheEntry(BaseModel):
    record_id: str
    batch_id: str
    file_hash: str
    merged_path: List[str]
    status: PathStatus
    processed_time: datetime
    issues: List[Dict[str, Any]] = Field(default_factory=list)


class QueryFilter(BaseModel):
    record_id: Optional[str] = None
    batch_id: Optional[str] = None
    status: Optional[PathStatus] = None
    issue_type: Optional[IssueType] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    agent_id: Optional[str] = None
