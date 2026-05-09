from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime


class TaskResponse(BaseModel):
    id: int
    task_id: str
    task_type: str
    status: str
    progress: int
    retry_count: int
    max_retries: int
    next_retry_at: Optional[datetime] = None
    parameters: Optional[Dict[str, Any]] = None
    result: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    export_file: Optional[str] = None

    class Config:
        from_attributes = True


class ExportRequest(BaseModel):
    export_type: str = Field(..., description="导出类型: baseline, saving, energy_data, production_data, audit")
    equipment_ids: Optional[list] = Field(None, description="设备ID列表")
    group_ids: Optional[list] = Field(None, description="分组ID列表")
    baseline_id: Optional[int] = Field(None, description="基线版本ID")
    period_start: Optional[datetime] = Field(None, description="开始时间")
    period_end: Optional[datetime] = Field(None, description="结束时间")
    file_format: str = Field("xlsx", description="文件格式: xlsx, csv")
    created_by: Optional[str] = Field(None, description="创建人")


class RetryTaskRequest(BaseModel):
    task_id: str
    force: Optional[bool] = Field(False, description="是否强制重试，即使已达到最大重试次数")
