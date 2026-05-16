from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class TaskCreate(BaseModel):
    task_id: str = Field(..., description="任务编号")
    task_name: str = Field(..., description="任务名称")
    total_shards: int = Field(default=1, ge=1, description="总分片数")
    target_watermark: int = Field(default=0, ge=0, description="目标水位点")
    task_metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="元数据")


class TaskResponse(BaseModel):
    id: str
    task_name: str
    status: str
    total_shards: int
    current_watermark: int
    target_watermark: int
    created_at: datetime
    updated_at: datetime
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    task_metadata: Dict[str, Any]

    class Config:
        from_attributes = True


class ShardResponse(BaseModel):
    task_id: str
    shard_no: int
    status: str
    start_offset: int
    end_offset: int
    current_offset: int
    processed_count: int
    success_count: int
    failed_count: int

    class Config:
        from_attributes = True


class ShardProgressUpdate(BaseModel):
    shard_no: int = Field(..., ge=0, description="分片编号")
    current_offset: int = Field(..., ge=0, description="当前offset")
    processed_count: int = Field(default=0, ge=0, description="已处理数量")
    success_count: int = Field(default=0, ge=0, description="成功数量")
    failed_count: int = Field(default=0, ge=0, description="失败数量")
    checksum: Optional[str] = Field(None, description="校验和")


class TaskProgressUpdate(BaseModel):
    shards: List[ShardProgressUpdate] = Field(..., description="分片进度列表")
    watermark: Optional[int] = Field(None, ge=0, description="全局水位点")


class FailureRecordCreate(BaseModel):
    shard_no: int = Field(..., description="分片编号")
    offset: int = Field(..., description="失败offset")
    raw_input: str = Field(..., description="原始输入")
    process_context: Optional[str] = Field(None, description="处理依据")
    error_message: str = Field(..., description="错误信息")
    error_stack: Optional[str] = Field(None, description="错误栈")


class FailureRecordResponse(BaseModel):
    id: int
    task_id: str
    shard_no: int
    offset: int
    raw_input: str
    process_context: Optional[str]
    error_message: str
    final_status: str
    is_manually_fixed: bool
    fix_note: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ManualFixRequest(BaseModel):
    failure_id: int = Field(..., description="失败记录ID")
    fix_note: str = Field(..., description="修正说明")
    final_status: str = Field(default="fixed", description="最终状态")


class TaskDetailResponse(TaskResponse):
    shards: List[ShardResponse]
    failure_count: int


class ResumeReportResponse(BaseModel):
    id: int
    task_id: str
    resume_no: int
    start_watermark: int
    end_watermark: int
    total_processed: int
    success_count: int
    failed_count: int
    already_synced: List[Any]
    resume_reason: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class TaskResumeRequest(BaseModel):
    resume_reason: Optional[str] = Field(None, description="续跑原因")
