from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional, List
from models import UrgentStatus


class PrintUrgentOrderBase(BaseModel):
    order_no: str = Field(..., max_length=50, description="订单编号")
    customer_name: str = Field(..., max_length=100, description="客户姓名")
    customer_phone: str = Field(..., max_length=20, description="客户电话")
    document_name: str = Field(..., max_length=200, description="文档名称")
    page_count: int = Field(..., gt=0, description="页数")
    color_mode: str = Field(..., max_length=20, description="彩色模式: color/black_white")
    paper_size: str = Field(..., max_length=20, description="纸张尺寸: A4/A3")
    double_sided: bool = Field(default=False, description="是否双面")
    binding_type: Optional[str] = Field(None, max_length=50, description="装订方式")
    original_promised_time: datetime = Field(..., description="原承诺交付时间")
    urgent_reason: str = Field(..., description="加急原因")
    operator: str = Field(..., max_length=50, description="操作人")


class PrintUrgentOrderCreate(PrintUrgentOrderBase):
    target_queue_position: int = Field(..., gt=0, description="目标插队位置")


class PrintUrgentOrderUpdate(BaseModel):
    status: Optional[UrgentStatus] = Field(None, description="状态")
    reject_reason: Optional[str] = Field(None, description="驳回原因")
    supplement_notes: Optional[str] = Field(None, description="补录备注")
    operator: str = Field(..., max_length=50, description="操作人")


class PrintUrgentOrderResponse(PrintUrgentOrderBase):
    id: int
    new_promised_time: Optional[datetime] = None
    queue_position_before: Optional[int] = None
    queue_position_after: Optional[int] = None
    status: UrgentStatus
    reject_reason: Optional[str] = None
    supplement_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CapacityLogBase(BaseModel):
    log_no: str = Field(..., max_length=50, description="日志编号")
    log_type: str = Field(..., max_length=30, description="日志类型")
    affected_order_no: Optional[str] = Field(None, max_length=50, description="受影响订单号")
    original_delivery_time: Optional[datetime] = Field(None, description="原交付时间")
    new_delivery_time: Optional[datetime] = Field(None, description="新交付时间")
    capacity_impact: float = Field(..., description="产能影响值")
    impact_description: str = Field(..., description="影响描述")
    operator: str = Field(..., max_length=50, description="操作人")


class CapacityLogResponse(CapacityLogBase):
    id: int
    urgent_order_id: Optional[int] = None
    is_rollback: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ErrorResponse(BaseModel):
    error_code: str
    error_message: str
    error_details: Optional[dict] = None
    timestamp: datetime


class UrgentOrderWithLogs(PrintUrgentOrderResponse):
    capacity_logs: List[CapacityLogResponse] = []


class ImportResult(BaseModel):
    success_count: int
    failed_count: int
    failed_rows: List[dict]
