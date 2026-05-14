from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class WatermarkConfig(BaseModel):
    enabled: bool = False
    text: Optional[str] = None
    font_size: int = 30
    opacity: float = 0.5
    position: str = "bottom_right"
    color: str = "#FFFFFF"


class TranscodeTaskCreate(BaseModel):
    original_image_url: Optional[str] = None
    original_image_name: Optional[str] = None
    original_width: Optional[int] = None
    original_height: Optional[int] = None
    original_size: Optional[int] = None
    original_format: Optional[str] = None
    target_width: Optional[int] = None
    target_height: Optional[int] = None
    target_format: Optional[str] = None
    target_quality: int = 85
    watermark_config: Optional[WatermarkConfig] = None
    priority: int = 0
    max_retries: int = 3
    created_by: Optional[str] = None
    idempotency_key: Optional[str] = None


class TranscodeTaskUpdate(BaseModel):
    status: Optional[str] = None
    watermark_confirmed: Optional[bool] = None
    approved_by: Optional[str] = None


class TranscodeTaskResponse(BaseModel):
    id: int
    request_id: str
    original_image_url: Optional[str]
    original_image_name: Optional[str]
    original_width: Optional[int]
    original_height: Optional[int]
    original_size: Optional[int]
    original_format: Optional[str]
    target_width: Optional[int]
    target_height: Optional[int]
    target_format: Optional[str]
    target_quality: int
    watermark_config: Optional[Dict[str, Any]]
    watermark_confirmed: bool
    status: str
    queue_position: Optional[int]
    priority: int
    retry_count: int
    max_retries: int
    last_error: Optional[str]
    output_url: Optional[str]
    output_size: Optional[int]
    product_list: Optional[List[Dict[str, Any]]]
    created_at: datetime
    updated_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_by: Optional[str]
    approved_by: Optional[str]
    approved_at: Optional[datetime]
    version: int
    parent_task_id: Optional[int]

    class Config:
        orm_mode = True


class TaskListResponse(BaseModel):
    tasks: List[TranscodeTaskResponse]
    total: int
    page: int
    page_size: int


class ErrorLogResponse(BaseModel):
    id: int
    task_id: int
    error_message: str
    error_stack: Optional[str]
    retry_attempt: int
    created_at: datetime

    class Config:
        orm_mode = True


class ExportRequest(BaseModel):
    status: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    created_by: Optional[str] = None
    export_format: str = "excel"


class ExportRecordResponse(BaseModel):
    id: int
    export_type: str
    file_name: str
    record_count: int
    file_size: Optional[int]
    created_by: Optional[str]
    created_at: datetime

    class Config:
        orm_mode = True


class TaskFilter(BaseModel):
    status: Optional[str] = None
    created_by: Optional[str] = None
    search: Optional[str] = None
    page: int = 1
    page_size: int = 20