from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from ..models.enums import BatchStatus, IdempotencyStrategy


class BatchBase(BaseModel):
    name: str = Field(..., max_length=200)
    description: Optional[str] = None
    idempotency_key: Optional[str] = None
    idempotency_strategy: IdempotencyStrategy = IdempotencyStrategy.IGNORE
    metadata: Optional[Dict[str, Any]] = None


class BatchCreate(BatchBase):
    created_by: str = Field(..., max_length=100)


class BatchUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class BatchStateChange(BaseModel):
    to_status: BatchStatus
    changed_by: str = Field(..., max_length=100)
    reason: str
    metadata: Optional[Dict[str, Any]] = None


class BatchResponse(BatchBase):
    id: int
    batch_number: str
    status: BatchStatus
    created_by: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    settled_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BatchDetailResponse(BatchResponse):
    material_count: int
    visitor_record_count: int
    state_changes: List[Dict[str, Any]]


class BatchListResponse(BaseModel):
    total: int
    items: List[BatchResponse]
    page: int
    page_size: int
