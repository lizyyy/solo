from pydantic import BaseModel, field_validator, model_validator
from datetime import datetime
from typing import Optional, List, Dict, Any
import json
from .models import BatchStatus, TaskStatus


class ChunkStrategyBase(BaseModel):
    name: str
    chunk_size: int = 512
    chunk_overlap: int = 50
    separator: str = "\n\n"
    description: Optional[str] = None


class ChunkStrategyCreate(ChunkStrategyBase):
    pass


class ChunkStrategy(ChunkStrategyBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DocumentBatchBase(BaseModel):
    batch_name: str
    source_type: Optional[str] = None
    total_documents: int = 0
    total_chunks: int = 0
    strategy_id: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None


class DocumentBatchCreate(DocumentBatchBase):
    pass


class DocumentBatchUpdate(BaseModel):
    batch_name: Optional[str] = None
    status: Optional[BatchStatus] = None
    progress: Optional[float] = None
    error_message: Optional[str] = None


class DocumentBatch(DocumentBatchBase):
    id: int
    status: BatchStatus
    progress: float
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

    @model_validator(mode="before")
    @classmethod
    def parse_metadata_from_orm(cls, data):
        metadata_value = None
        is_orm_object = False
        
        if isinstance(data, dict):
            if "metadata_" in data:
                metadata_value = data.get("metadata_")
            elif "metadata" in data:
                metadata_value = data.get("metadata")
        else:
            is_orm_object = True
            if hasattr(data, "metadata_"):
                metadata_value = getattr(data, "metadata_")
        
        if metadata_value and isinstance(metadata_value, str):
            try:
                parsed_metadata = json.loads(metadata_value)
                if is_orm_object:
                    object.__setattr__(data, "metadata", parsed_metadata)
                else:
                    data["metadata"] = parsed_metadata
            except json.JSONDecodeError:
                if is_orm_object:
                    object.__setattr__(data, "metadata", None)
                else:
                    data["metadata"] = None
        elif is_orm_object and metadata_value is None:
            object.__setattr__(data, "metadata", None)
        
        return data


class DocumentBatchDetail(DocumentBatch):
    chunk_strategy: Optional[ChunkStrategy] = None
    task_count: int
    failed_count: int
    completed_count: int
    retry_count: int

    class Config:
        from_attributes = True


class VectorTaskBase(BaseModel):
    batch_id: int
    document_id: Optional[str] = None
    chunk_index: Optional[int] = None
    chunk_text: Optional[str] = None
    embedding_model: Optional[str] = None
    vector_dimension: Optional[int] = None


class VectorTaskCreate(VectorTaskBase):
    pass


class VectorTaskUpdate(BaseModel):
    status: Optional[TaskStatus] = None
    error_message: Optional[str] = None
    retry_count: Optional[int] = None


class VectorTask(VectorTaskBase):
    id: int
    status: TaskStatus
    retry_count: int
    max_retries: int
    error_message: Optional[str] = None
    processing_started_at: Optional[datetime] = None
    processing_completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FailedChunkBase(BaseModel):
    batch_id: int
    task_id: int
    document_id: Optional[str] = None
    chunk_index: Optional[int] = None
    chunk_text: Optional[str] = None
    error_type: Optional[str] = None
    error_message: Optional[str] = None
    error_traceback: Optional[str] = None


class FailedChunkCreate(FailedChunkBase):
    pass


class FailedChunkUpdate(BaseModel):
    resolved: Optional[bool] = None
    resolved_at: Optional[datetime] = None


class FailedChunk(FailedChunkBase):
    id: int
    failed_at: datetime
    resolved: bool
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RetryQueueBase(BaseModel):
    batch_id: int
    task_id: int
    failed_chunk_id: Optional[int] = None
    priority: int = 0
    retry_after: Optional[datetime] = None


class RetryQueueCreate(RetryQueueBase):
    pass


class RetryQueue(RetryQueueBase):
    id: int
    retry_count: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class IndexResultBase(BaseModel):
    batch_id: int
    task_id: int
    document_id: Optional[str] = None
    chunk_index: Optional[int] = None
    vector_id: Optional[str] = None
    vector_checksum: Optional[str] = None


class IndexResultCreate(IndexResultBase):
    pass


class IndexResultUpdate(BaseModel):
    verified: Optional[bool] = None
    verified_at: Optional[datetime] = None
    verification_error: Optional[str] = None


class IndexResult(IndexResultBase):
    id: int
    indexed_at: datetime
    verified: bool
    verified_at: Optional[datetime] = None
    verification_error: Optional[str] = None

    class Config:
        from_attributes = True


class BatchReport(BaseModel):
    batch_id: int
    batch_name: str
    status: BatchStatus
    total_tasks: int
    completed_tasks: int
    failed_tasks: int
    pending_tasks: int
    progress: float
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    failed_chunks: List[FailedChunk] = []
    retry_queue_count: int


class IdempotentRequest(BaseModel):
    request_id: str
    operation: str
    data: Dict[str, Any]
