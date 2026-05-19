from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, validator


class OperationType(str, Enum):
    FREEZE = "freeze"
    RELEASE = "release"


class FreezeReason(str, Enum):
    COMPLAINT = "complaint"
    AUDIT = "audit"
    LEGAL = "legal"
    SECURITY = "security"
    OTHER = "other"


class ReleaseStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class SourceInfo(BaseModel):
    file_path: str
    line_number: Optional[int] = None
    raw_content: str


class AuditRecord(BaseModel):
    id: str = Field(..., description="记录唯一标识")
    operation_type: OperationType
    log_topic: str = Field(..., description="日志主题")
    start_time: datetime = Field(..., description="冻结开始时间")
    end_time: datetime = Field(..., description="冻结结束时间")
    freeze_reason: FreezeReason
    applicant: str = Field(..., description="申请人")
    release_condition: Optional[str] = Field(None, description="释放条件")
    release_status: Optional[ReleaseStatus] = Field(None, description="释放审批状态")
    approval_time: Optional[datetime] = Field(None, description="审批时间")
    approver: Optional[str] = Field(None, description="审批人")
    created_at: datetime = Field(default_factory=datetime.now)
    source_info: Optional[SourceInfo] = None

    @validator('end_time')
    def end_time_after_start_time(cls, v, values):
        if 'start_time' in values and v <= values['start_time']:
            raise ValueError('end_time must be after start_time')
        return v

    def get_time_range_key(self) -> str:
        return f"{self.log_topic}_{self.start_time.isoformat()}_{self.end_time.isoformat()}"

    def get_idempotency_key(self) -> str:
        return (
            f"{self.operation_type}_{self.log_topic}_"
            f"{self.start_time.isoformat()}_{self.end_time.isoformat()}_"
            f"{self.applicant}_{self.freeze_reason}"
        )


class ValidationError(BaseModel):
    error_type: str
    message: str
    source_info: Optional[SourceInfo] = None
    record_id: Optional[str] = None


class TimeRangeOverlap(BaseModel):
    record1_id: str
    record2_id: str
    overlap_start: datetime
    overlap_end: datetime


class AuditResult(BaseModel):
    valid_records: Dict[str, AuditRecord] = Field(default_factory=dict)
    invalid_records: list = Field(default_factory=list)
    duplicates: list = Field(default_factory=list)
    overlaps: list = Field(default_factory=list)
    pending_releases: list = Field(default_factory=list)
    merged_ranges: Dict[str, Any] = Field(default_factory=dict)
