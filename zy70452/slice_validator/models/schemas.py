from datetime import datetime
from enum import Enum
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field


class SliceStatus(str, Enum):
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"
    PENDING = "pending"
    CONFLICT = "conflict"


class FailureType(str, Enum):
    CHECKSUM_MISMATCH = "checksum_mismatch"
    SIZE_MISMATCH = "size_mismatch"
    MISSING_SLICE = "missing_slice"
    CORRUPTED_DATA = "corrupted_data"
    TIMEOUT = "timeout"
    DUPLICATE_RECORD = "duplicate_record"
    PARTIAL_SUCCESS = "partial_success"


class PartitionInfo(BaseModel):
    partition_date: str
    region: str
    business_line: str
    slice_count: int


class SliceFile(BaseModel):
    file_name: str
    file_path: str
    file_size: int
    slice_index: int
    checksum: str
    record_count: int
    status: SliceStatus = SliceStatus.PENDING


class BatchSubmission(BaseModel):
    batch_id: str
    submission_time: datetime = Field(default_factory=datetime.now)
    source_system: str
    business_line: str
    partitions: List[PartitionInfo]
    slices: List[SliceFile]
    expected_total_slices: int
    expected_total_records: int


class ValidationResult(BaseModel):
    batch_id: str
    validation_time: datetime = Field(default_factory=datetime.now)
    overall_status: SliceStatus
    success_count: int
    failed_count: int
    partial_count: int
    total_slices: int
    failure_groups: Dict[FailureType, List[str]]
    validated_slices: List[Dict[str, Any]]


class CandidateAction(BaseModel):
    action_id: str
    action_type: str
    reason: str
    affected_files: List[str]
    created_at: datetime = Field(default_factory=datetime.now)
    requires_manual_confirmation: bool = True


class RollbackPlan(BaseModel):
    plan_id: str
    batch_id: str
    candidates: List[CandidateAction]
    status: str = "pending_confirmation"
    created_at: datetime = Field(default_factory=datetime.now)
