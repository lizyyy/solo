from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.models import ChannelStatus, BatchStatus


class ChannelBase(BaseModel):
    channel_code: str = Field(..., max_length=100, description="通道编码")
    channel_name: str = Field(..., max_length=200, description="通道名称")
    source_system: str = Field(..., max_length=100, description="源系统")
    target_system: str = Field(..., max_length=100, description="目标系统")
    description: Optional[str] = Field(None, description="描述")


class ChannelCreate(ChannelBase):
    initial_watermark: Optional[str] = Field(None, description="初始水位值")
    created_by: Optional[str] = Field("system", description="创建人")


class ChannelUpdate(BaseModel):
    channel_name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ChannelStatus] = None
    updated_by: Optional[str] = "system"


class ChannelResponse(ChannelBase):
    id: int
    status: ChannelStatus
    current_watermark: Optional[str]
    current_watermark_time: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    created_by: str
    updated_by: str

    class Config:
        from_attributes = True


class WatermarkBase(BaseModel):
    watermark_value: str = Field(..., max_length=200, description="水位值")
    watermark_time: datetime = Field(..., description="水位时间")


class WatermarkCreate(WatermarkBase):
    channel_code: str = Field(..., description="通道编码")
    created_by: Optional[str] = Field("system", description="创建人")
    remark: Optional[str] = Field(None, description="备注")


class WatermarkResponse(WatermarkBase):
    id: int
    channel_id: int
    sequence: int
    is_current: bool
    created_at: datetime
    created_by: str
    remark: Optional[str]

    class Config:
        from_attributes = True


class BatchBase(BaseModel):
    batch_id: str = Field(..., max_length=100, description="批次ID")
    start_watermark: str = Field(..., max_length=200, description="起始水位")
    end_watermark: str = Field(..., max_length=200, description="结束水位")
    record_count: Optional[int] = Field(0, description="记录数")
    data_size: Optional[int] = Field(0, description="数据大小")


class BatchCreate(BatchBase):
    channel_code: str = Field(..., description="通道编码")
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class BatchUpdate(BaseModel):
    status: Optional[BatchStatus] = None
    processed_by: Optional[str] = None
    error_message: Optional[str] = None


class BatchResponse(BatchBase):
    id: int
    channel_id: int
    status: BatchStatus
    created_at: datetime
    updated_at: datetime
    processed_by: Optional[str]
    error_message: Optional[str]

    class Config:
        from_attributes = True


class ConfirmationBase(BaseModel):
    consumer_id: str = Field(..., max_length=100, description="消费者ID")
    confirmed_count: int = Field(0, description="确认记录数")
    success: bool = Field(True, description="是否成功")
    processing_time_ms: Optional[float] = Field(None, description="处理耗时(ms)")


class ConfirmationCreate(ConfirmationBase):
    batch_id: str = Field(..., description="批次ID（业务字符串ID）")
    error_message: Optional[str] = None


class ConfirmationResponse(ConfirmationBase):
    id: int
    batch_id: int = Field(..., description="批次数据库ID（外键）")
    batch_id_str: str = Field("", description="批次业务ID（字符串）")
    watermark_id: int
    confirmed_at: datetime
    error_message: Optional[str]

    class Config:
        from_attributes = True


class RollbackPointBase(BaseModel):
    point_name: str = Field(..., max_length=200, description="回退点名称")
    watermark_value: str = Field(..., max_length=200, description="水位值")
    watermark_time: datetime = Field(..., description="水位时间")


class RollbackPointCreate(RollbackPointBase):
    channel_code: str = Field(..., description="通道编码")
    created_by: Optional[str] = Field("system", description="创建人")
    remark: Optional[str] = Field(None, description="备注")


class RollbackPointResponse(RollbackPointBase):
    id: int
    channel_id: int
    created_at: datetime
    created_by: str
    is_active: bool
    remark: Optional[str]

    class Config:
        from_attributes = True


class RollbackExecute(BaseModel):
    channel_code: str = Field(..., description="通道编码")
    rollback_point_id: int = Field(..., description="回退点ID")
    executed_by: str = Field(..., description="执行人")
    remark: Optional[str] = Field(None, description="备注")


class DiffSummaryBase(BaseModel):
    start_watermark: str = Field(..., max_length=200, description="起始水位")
    end_watermark: str = Field(..., max_length=200, description="结束水位")
    source_count: int = Field(0, description="源端记录数")
    target_count: int = Field(0, description="目标端记录数")
    missing_in_target: int = Field(0, description="目标端缺失数")
    missing_in_source: int = Field(0, description="源端缺失数")
    mismatch_count: int = Field(0, description="不匹配数")


class DiffSummaryCreate(DiffSummaryBase):
    channel_code: str = Field(..., description="通道编码")
    scan_start_time: datetime = Field(..., description="扫描开始时间")
    scan_end_time: datetime = Field(..., description="扫描结束时间")
    scanned_by: Optional[str] = Field("system", description="扫描人")
    remark: Optional[str] = Field(None, description="备注")


class DiffSummaryResponse(DiffSummaryBase):
    id: int
    channel_id: int
    scan_start_time: datetime
    scan_end_time: datetime
    diff_count: int
    scan_status: str
    created_at: datetime
    scanned_by: str
    remark: Optional[str]

    class Config:
        from_attributes = True


class ChannelDetailResponse(ChannelResponse):
    recent_watermarks: List[WatermarkResponse]
    recent_batches: List[BatchResponse]
    active_rollback_points: List[RollbackPointResponse]
    recent_diff_summaries: List[DiffSummaryResponse]


class ApiResponse(BaseModel):
    success: bool
    code: int
    message: str
    data: Optional[dict] = None


class WatermarkAdvanceResponse(BaseModel):
    success: bool
    message: str
    previous_watermark: Optional[str]
    new_watermark: str
    is_idempotent: bool
