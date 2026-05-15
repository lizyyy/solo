from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from .models import TaskStatus, ArchiveStrategy, AccessLevel


class TaskBase(BaseModel):
    task_number: str = Field(..., description="任务编号，唯一标识")
    task_name: Optional[str] = Field(None, description="任务名称")
    description: Optional[str] = Field(None, description="任务描述")
    archive_strategy: ArchiveStrategy = Field(default=ArchiveStrategy.DELAYED, description="归档策略")
    access_level: AccessLevel = Field(default=AccessLevel.READ, description="访问权限级别")
    owner: str = Field(..., description="任务所有者")
    expire_days: Optional[int] = Field(90, gt=0, description="过期天数，必须为正数")


class TaskCreate(TaskBase):
    pass


class TaskRegister(BaseModel):
    output_file_path: str = Field(..., description="输出文件路径")
    output_file_name: str = Field(..., description="输出文件名")
    output_file_size: int = Field(..., gt=0, description="文件大小（字节），必须为正数")
    output_file_hash: str = Field(..., description="文件哈希值")
    operator: Optional[str] = Field(None, description="操作人")


class TaskArchive(BaseModel):
    target_location: str = Field(..., description="归档目标位置")
    operator: Optional[str] = Field(None, description="操作人")


class TaskRevoke(BaseModel):
    reason: str = Field(..., description="撤销原因")
    operator: Optional[str] = Field(None, description="操作人")


class TaskResponse(BaseModel):
    id: int
    task_number: str
    task_name: Optional[str]
    description: Optional[str]
    status: TaskStatus
    archive_strategy: ArchiveStrategy
    output_file_path: Optional[str]
    output_file_name: Optional[str]
    output_file_size: Optional[int]
    output_file_hash: Optional[str]
    access_level: AccessLevel
    owner: str
    archive_location: Optional[str]
    expire_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TimelineResponse(BaseModel):
    id: int
    task_id: int
    action: str
    status_before: Optional[str]
    status_after: Optional[str]
    operator: Optional[str]
    description: Optional[str]
    details: Optional[Dict[str, Any]]
    timestamp: datetime

    class Config:
        from_attributes = True


class ArchiveRecordResponse(BaseModel):
    id: int
    task_id: int
    source_location: Optional[str]
    target_location: Optional[str]
    archive_size: Optional[int]
    operator: Optional[str]
    is_successful: bool
    error_message: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class CleanupRecordResponse(BaseModel):
    id: int
    task_id: int
    cleaned_location: Optional[str]
    cleanup_reason: Optional[str]
    operator: Optional[str]
    is_successful: bool
    error_message: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class TaskDetailResponse(TaskResponse):
    timelines: List[TimelineResponse]
    archive_records: List[ArchiveRecordResponse]
    cleanup_records: List[CleanupRecordResponse]


class TaskListResponse(BaseModel):
    total: int
    items: List[TaskResponse]


class ExportRequest(BaseModel):
    task_numbers: Optional[List[str]] = Field(None, description="指定任务编号列表，为空则导出全部")
    start_date: Optional[datetime] = Field(None, description="开始时间")
    end_date: Optional[datetime] = Field(None, description="结束时间")
    include_timelines: bool = Field(default=True, description="是否包含时间线")
    include_archive_records: bool = Field(default=True, description="是否包含归档记录")
    include_cleanup_records: bool = Field(default=True, description="是否包含清理记录")


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None
