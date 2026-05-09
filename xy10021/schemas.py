from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Dict, Any, List
from enum import Enum


class SourceType(str, Enum):
    FILE = "file"
    DATABASE = "database"
    API = "api"


class LogLevel(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"


class LogSourceCreate(BaseModel):
    name: str = Field(..., max_length=255)
    source_type: SourceType
    config: Dict[str, Any]
    description: Optional[str] = None
    is_active: bool = True


class LogSourceUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    source_type: Optional[SourceType] = None
    config: Optional[Dict[str, Any]] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    version: int


class LogSourceResponse(BaseModel):
    id: int
    name: str
    source_type: SourceType
    config: Dict[str, Any]
    description: Optional[str]
    is_active: bool
    version: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class LogEntryCreate(BaseModel):
    source_id: int
    log_time: datetime
    log_level: LogLevel
    message: str
    module: Optional[str] = None
    trace_id: Optional[str] = None
    extra_data: Optional[Dict[str, Any]] = None


class LogEntryResponse(BaseModel):
    id: int
    source_id: int
    log_time: datetime
    log_level: LogLevel
    message: str
    module: Optional[str]
    trace_id: Optional[str]
    extra_data: Optional[Dict[str, Any]]
    created_at: datetime
    
    class Config:
        from_attributes = True


class TaskResponse(BaseModel):
    id: str
    task_type: str
    status: TaskStatus
    data: Optional[Dict[str, Any]]
    result: Optional[Dict[str, Any]]
    error_message: Optional[str]
    retry_count: int
    max_retries: int
    scheduled_at: Optional[datetime]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    action: str
    resource_type: str
    resource_id: Optional[str]
    old_value: Optional[Dict[str, Any]]
    new_value: Optional[Dict[str, Any]]
    user_id: Optional[str]
    ip_address: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class LogQuery(BaseModel):
    source_id: Optional[int] = None
    log_level: Optional[LogLevel] = None
    keyword: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    page: int = 1
    page_size: int = 20


class ReportRequest(BaseModel):
    source_id: Optional[int] = None
    log_level: Optional[LogLevel] = None
    start_time: datetime
    end_time: datetime
    report_type: str = "summary"


class LogIngestRequest(BaseModel):
    source_id: int
    logs: List[LogEntryCreate]
