from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from models import UploadStatus, ChunkStatus


class UploadTaskCreate(BaseModel):
    file_name: str
    file_size: int
    chunk_size: int
    file_hash: str
    callback_url: Optional[str] = None
    max_retries: Optional[int] = 3


class UploadTaskResponse(BaseModel):
    id: str
    file_name: str
    file_size: int
    total_chunks: int
    chunk_size: int
    file_hash: str
    status: UploadStatus
    resume_point: int
    retry_count: int
    max_retries: int
    callback_url: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    completed_at: Optional[datetime]
    error_message: Optional[str]

    class Config:
        from_attributes = True


class ChunkRegister(BaseModel):
    task_id: str
    chunk_number: int
    chunk_size: int
    chunk_hash: str


class ChunkResponse(BaseModel):
    id: str
    task_id: str
    chunk_number: int
    chunk_size: int
    chunk_hash: str
    status: ChunkStatus
    retry_count: int
    uploaded_at: Optional[datetime]
    verified_at: Optional[datetime]
    error_message: Optional[str]

    class Config:
        from_attributes = True


class ChunkUploadComplete(BaseModel):
    chunk_id: str
    chunk_hash: str


class StatusHistoryResponse(BaseModel):
    id: int
    task_id: str
    previous_status: Optional[str]
    new_status: str
    changed_at: datetime
    changed_by: str
    note: Optional[str]

    class Config:
        from_attributes = True


class UploadTaskDetail(UploadTaskResponse):
    chunks: List[ChunkResponse]
    history: List[StatusHistoryResponse]


class TaskReview(BaseModel):
    task_id: str
    action: str
    note: Optional[str] = None


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None


class SuccessResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None
