from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class DocumentVersionCreate(BaseModel):
    document_id: str = Field(..., min_length=1, max_length=100)
    version: int = Field(..., ge=1)
    content_hash: str = Field(..., min_length=1, max_length=64)
    title: Optional[str] = Field(None, max_length=500)
    content: Optional[str] = None


class DocumentVersionResponse(BaseModel):
    id: int
    document_id: str
    version: int
    content_hash: str
    title: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class IndexTaskCreate(BaseModel):
    task_id: str = Field(..., min_length=1, max_length=100)
    target_document_count: int = Field(..., ge=1)


class IndexTaskResponse(BaseModel):
    id: int
    task_id: str
    status: str
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    failed_at: Optional[datetime]
    error_message: Optional[str]
    rollback_status: Optional[str]
    target_document_count: int
    processed_document_count: int
    success_document_count: int
    failed_document_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class ShardValidationCreate(BaseModel):
    shard_id: str = Field(..., min_length=1, max_length=100)
    document_version_id: int = Field(..., ge=1)
    expected_hash: str = Field(..., min_length=1, max_length=64)


class ShardValidationResponse(BaseModel):
    id: int
    shard_id: str
    document_version_id: int
    expected_hash: str
    actual_hash: Optional[str]
    is_valid: Optional[bool]
    validated_at: Optional[datetime]
    error_message: Optional[str]

    class Config:
        from_attributes = True


class RecallSampleCreate(BaseModel):
    query: str = Field(..., min_length=1)
    expected_document_id: str = Field(..., min_length=1, max_length=100)
    expected_version: int = Field(..., ge=1)


class RecallSampleResponse(BaseModel):
    id: int
    query: str
    expected_document_id: str
    expected_version: int
    actual_document_id: Optional[str]
    actual_version: Optional[int]
    score: Optional[float]
    is_match: Optional[bool]
    sampled_at: datetime

    class Config:
        from_attributes = True


class RebuildReportResponse(BaseModel):
    id: int
    overall_status: str
    total_documents: int
    validated_documents: int
    valid_documents: int
    invalid_documents: int
    recall_samples_count: int
    recall_match_count: int
    recall_accuracy: float
    summary: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class RebuildIndexRequest(BaseModel):
    task_id: str = Field(..., min_length=1, max_length=100)
    document_versions: List[DocumentVersionCreate] = Field(..., min_length=1)
    recall_samples: Optional[List[RecallSampleCreate]] = Field(default=None)
    enable_rollback: bool = Field(default=True)


class RebuildIndexResponse(BaseModel):
    task_id: str
    status: str
    message: str


class TaskStatusResponse(BaseModel):
    task: IndexTaskResponse
    validations: List[ShardValidationResponse]
    recall_samples: List[RecallSampleResponse]
    reports: List[RebuildReportResponse]


class RollbackRequest(BaseModel):
    task_id: str = Field(..., min_length=1, max_length=100)
    reason: str = Field(..., min_length=1)
