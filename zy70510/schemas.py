from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from models import TaskStatus, TriggerSource


class TaskBatchCreate(BaseModel):
    batch_name: str = Field(..., description="批次名称")
    trigger_source: TriggerSource = Field(..., description="触发来源")
    idempotent_key: str = Field(..., description="幂等键，用于去重")
    original_input: Dict[str, Any] = Field(..., description="原始输入数据")
    items: Optional[List[Dict[str, Any]]] = Field(None, description="处理明细列表")
    operator: Optional[str] = Field(None, description="操作人")
    remark: Optional[str] = Field(None, description="备注")


class ProcessDetailUpdate(BaseModel):
    item_key: str = Field(..., description="明细项唯一标识")
    status: TaskStatus = Field(..., description="处理状态")
    result_data: Optional[Dict[str, Any]] = Field(None, description="结果数据")
    error_message: Optional[str] = Field(None, description="错误信息")
    processing_basis: Optional[Dict[str, Any]] = Field(None, description="处理依据")


class TaskBatchStatusUpdate(BaseModel):
    status: TaskStatus = Field(..., description="目标状态")
    result_snapshot: Optional[Dict[str, Any]] = Field(None, description="结果快照")
    error_message: Optional[str] = Field(None, description="错误信息")
    operator: Optional[str] = Field(None, description="操作人")


class ManualFixRequest(BaseModel):
    receipt_no: str = Field(..., description="收据编号")
    final_conclusion: str = Field(..., description="最终结论")
    result_summary: Optional[Dict[str, Any]] = Field(None, description="结果摘要")
    operator: str = Field(..., description="操作人")
    detail_fixes: Optional[List[Dict[str, Any]]] = Field(None, description="明细修正")


class ReceiptResponse(BaseModel):
    receipt_no: str
    batch_id: int
    batch_no: str
    batch_name: str
    idempotent_key: str
    trigger_source: TriggerSource
    status: TaskStatus
    final_conclusion: Optional[str]
    result_summary: Optional[Dict[str, Any]]
    total_count: int
    success_count: int
    failed_count: int
    issued_at: datetime
    issued_by: Optional[str]
    is_duplicate: bool = False
    merged_into: Optional[str] = None

    class Config:
        from_attributes = True


class TaskBatchQuery(BaseModel):
    idempotent_key: Optional[str] = None
    batch_no: Optional[str] = None
    receipt_no: Optional[str] = None
    status: Optional[TaskStatus] = None
    trigger_source: Optional[TriggerSource] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    page: int = 1
    page_size: int = 20


class ExportRequest(BaseModel):
    query: Optional[TaskBatchQuery] = None
    receipt_nos: Optional[List[str]] = None
    export_format: str = Field(default="xlsx", description="导出格式: xlsx, csv")
    include_details: bool = Field(default=True, description="是否包含明细")
