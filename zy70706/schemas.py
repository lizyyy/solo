from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    NEED_REVIEW = "need_review"
    SKIPPED = "skipped"


class ErrorCode(str, Enum):
    MISSING_FIELD = "missing_field"
    INVALID_STATUS = "invalid_status"
    NEED_MANUAL_REVIEW = "need_manual_review"
    ALREADY_PROCESSED = "already_processed"
    WATERMARK_CONFLICT = "watermark_conflict"
    SHARD_OVERLAP = "shard_overlap"


class PipelineTaskCreate(BaseModel):
    pipeline_name: str = Field(..., min_length=1)
    shard_start: int = Field(..., ge=0)
    shard_end: int = Field(..., ge=0)
    watermark: int = Field(..., ge=0)
    max_retry: Optional[int] = 3

    @validator('shard_end')
    def shard_end_must_ge_start(cls, v, values):
        if 'shard_start' in values and v < values['shard_start']:
            raise ValueError('shard_end must be greater than or equal to shard_start')
        return v


class PipelineTaskUpdate(BaseModel):
    status: Optional[TaskStatus] = None
    watermark: Optional[int] = None
    fail_reason: Optional[str] = None
    need_manual_review: Optional[bool] = None
    review_comment: Optional[str] = None


class WriteSummaryCreate(BaseModel):
    task_id: int
    pipeline_name: str
    shard_start: int
    shard_end: int
    write_count: int = 0
    update_count: int = 0
    skip_count: int = 0
    error_count: int = 0
    data_size_bytes: float = 0
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class ResumeCommandCreate(BaseModel):
    pipeline_name: str = Field(..., min_length=1)
    target_watermark: int = Field(..., ge=0)
    force: Optional[bool] = False
    skip_shards: Optional[str] = None
    created_by: Optional[str] = None


class ErrorResponse(BaseModel):
    error_code: ErrorCode
    message: str
    details: Optional[dict] = None


class PipelineTaskResponse(BaseModel):
    id: int
    pipeline_name: str
    shard_start: int
    shard_end: int
    watermark: int
    status: str
    fail_reason: Optional[str]
    retry_count: int
    max_retry: int
    need_manual_review: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class WriteSummaryResponse(BaseModel):
    id: int
    task_id: int
    pipeline_name: str
    shard_start: int
    shard_end: int
    write_count: int
    update_count: int
    skip_count: int
    error_count: int
    data_size_bytes: float
    duration_seconds: float
    created_at: datetime

    class Config:
        orm_mode = True


class ResumeCommandResponse(BaseModel):
    id: int
    pipeline_name: str
    target_watermark: int
    force: bool
    command_status: str
    created_at: datetime

    class Config:
        orm_mode = True


class PendingTasksResponse(BaseModel):
    tasks: List[PipelineTaskResponse]
    total: int


class ExportSummaryResponse(BaseModel):
    file_name: str
    export_count: int
    total_writes: int
    total_updates: int
    total_skips: int
    total_errors: int
