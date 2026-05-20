from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional, List
from models import UploadStatus, ChunkStatus


class UploadTaskCreate(BaseModel):
    file_name: str
    file_size: int = Field(..., gt=0, description="文件大小必须大于0")
    chunk_size: int = Field(..., gt=0, description="分片大小必须大于0")
    file_hash: str
    callback_url: Optional[str] = None
    max_retries: Optional[int] = Field(3, ge=0, le=10, description="最大重试次数必须在0-10之间")
    
    @field_validator('file_name')
    @classmethod
    def file_name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("文件名不能为空")
        return v
    
    @field_validator('file_hash')
    @classmethod
    def file_hash_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("文件哈希不能为空")
        return v


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
