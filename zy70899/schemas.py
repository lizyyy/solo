from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from models import TaskStatus, DataCategory


class HandoverCreate(BaseModel):
    branch_id: str = Field(..., description="网点编号")
    branch_name: Optional[str] = Field(None, description="网点名称")
    handover_date: datetime = Field(..., description="交接日期")
    handover_type: Optional[str] = Field(None, description="交接类型：早班/晚班/跨日")
    box_no: str = Field(..., description="尾箱编号")
    box_amount: float = Field(..., description="尾箱金额")
    error_no: Optional[str] = Field(None, description="差错编号")
    handler1_id: str = Field(..., description="交接人1编号")
    handler1_name: str = Field(..., description="交接人1姓名")
    handler2_id: str = Field(..., description="交接人2编号")
    handler2_name: str = Field(..., description="交接人2姓名")
    is_cross_day: int = Field(0, description="是否跨日交接：0否1是")
    previous_unclosed_reason: Optional[str] = Field(None, description="上一班未闭合原因")
    raw_data_position: Optional[str] = Field(None, description="原始材料位置")
    created_by: str = Field(..., description="创建人")


class HandoverUpdate(BaseModel):
    category: Optional[DataCategory] = None
    category_reason: Optional[str] = None
    subsequent_action: Optional[str] = None
    status: Optional[TaskStatus] = None
    error_details: Optional[str] = None


class HandoverResponse(BaseModel):
    id: int
    task_id: str
    branch_id: str
    branch_name: Optional[str]
    handover_date: datetime
    handover_type: Optional[str]
    box_no: str
    box_amount: float
    error_no: Optional[str]
    handler1_id: str
    handler1_name: str
    handler2_id: str
    handler2_name: str
    is_cross_day: int
    previous_unclosed_reason: Optional[str]
    category: Optional[DataCategory]
    category_reason: Optional[str]
    subsequent_action: Optional[str]
    status: TaskStatus
    error_details: Optional[str]
    raw_data_position: Optional[str]
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str]

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    task_id: str
    field_changed: str
    old_value: Optional[str]
    new_value: Optional[str]
    change_reason: str
    changed_by_id: str
    changed_by_name: str
    changed_at: datetime

    class Config:
        from_attributes = True


class FieldTraceResponse(BaseModel):
    id: int
    task_id: str
    field_name: str
    raw_value: Optional[str]
    processed_value: Optional[str]
    final_value: Optional[str]
    trace_path: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ConclusionUpdate(BaseModel):
    field_changed: str = Field(..., description="修改的字段")
    old_value: str = Field(..., description="修改前的值")
    new_value: str = Field(..., description="修改后的值")
    change_reason: str = Field(..., description="修改原因")
    changed_by_id: str = Field(..., description="修改人编号")
    changed_by_name: str = Field(..., description="修改人姓名")


class ProcessingResult(BaseModel):
    category: DataCategory
    category_reason: str
    subsequent_action: str
    error_details: Optional[str] = None


class TaskListResponse(BaseModel):
    total: int
    items: List[HandoverResponse]
