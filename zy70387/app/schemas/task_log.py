from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class TaskLogCreate(BaseModel):
    task_id: str = Field(..., description="任务唯一标识")
    tenant_id: str = Field(..., description="租户ID")
    task_type: str = Field(..., description="任务类型")
    log_level: str = Field(default="INFO", description="日志级别")
    message: str = Field(..., description="日志内容")
    is_success: Optional[bool] = Field(default=True, description="是否成功")
    is_failure: Optional[bool] = Field(default=False, description="是否失败")
    timestamp: Optional[datetime] = Field(default=None, description="日志时间戳")


class TaskLogResponse(BaseModel):
    id: int
    task_id: str
    tenant_id: str
    task_type: str
    log_level: str
    message: str
    timestamp: datetime
    is_success: bool
    is_failure: bool
    is_sampled: bool
    is_failure_context: bool
    rule_id: Optional[int]
    rule_version: Optional[int]
    created_at: datetime
    
    class Config:
        from_attributes = True


class TaskLogQuery(BaseModel):
    tenant_id: Optional[str] = None
    task_type: Optional[str] = None
    task_id: Optional[str] = None
    is_sampled: Optional[bool] = None
    is_failure: Optional[bool] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    page: int = 1
    page_size: int = 50


class LogWriteResult(BaseModel):
    success: bool
    saved: bool
    reason: str
    rule_id: Optional[int]
    rule_name: Optional[str]
    is_sampled: bool
    is_failure_context: bool
    message: str
