from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class DataSource(str, Enum):
    RECEIPT = "领用单"
    PURCHASE_ARRIVAL = "采购到货表"
    TEACHER_SIGN = "老师补签记录"
    TEMP_SUPPLEMENT = "临时补录单"
    SHIFT_RECORD = "班次记录"


class ConsumableStatus(str, Enum):
    PENDING = "待验收"
    ACCEPTED = "已验收"
    REJECTED = "已驳回"
    BORROWED = "课题组借用"
    LOST = "损耗"
    AUDIT_PENDING = "待审计"
    AUDIT_PASS = "审计通过"
    EXCEPTION = "异常"
    RESOLVED = "已解决"


class TaskStatus(str, Enum):
    PENDING = "待处理"
    PROCESSING = "处理中"
    WAIT_RETRY = "等重试"
    WAIT_MANUAL = "等人工"
    FAILED_PERMANENT = "永久失败"
    COMPLETED = "已完成"


class ConsumableRecordBase(BaseModel):
    consumable_name: str = Field(..., description="耗材名称")
    specification: Optional[str] = Field(None, description="规格型号")
    quantity: float = Field(..., description="数量")
    unit: str = Field(..., description="单位")
    batch_no: Optional[str] = Field(None, description="批号")
    expire_date: Optional[datetime] = Field(None, description="有效期")
    supplier: Optional[str] = Field(None, description="供应商")
    data_source: DataSource = Field(..., description="数据来源")
    lab: Optional[str] = Field(None, description="实验室")
    research_group: Optional[str] = Field(None, description="课题组")


class ConsumableRecordCreate(ConsumableRecordBase):
    original_file_name: Optional[str] = Field(None, description="原始文件名")
    original_row_number: Optional[int] = Field(None, description="原始行号")
    original_data: Optional[Dict[str, Any]] = Field(None, description="原始数据")
    created_by: str = Field(..., description="创建人")


class ConsumableRecordUpdate(BaseModel):
    current_status: Optional[ConsumableStatus] = Field(None, description="当前状态")
    missing_direction_reason: Optional[str] = Field(None, description="缺去向处理原因")
    borrow_loss_mixed: Optional[bool] = Field(None, description="借用和损耗混合")


class ConsumableRecordResponse(ConsumableRecordBase):
    id: int
    record_no: str
    current_status: ConsumableStatus
    is_duplicate: bool
    duplicate_of: Optional[int]
    original_file_name: Optional[str]
    original_row_number: Optional[int]
    missing_direction_reason: Optional[str]
    borrow_loss_mixed: bool
    created_at: datetime
    updated_at: Optional[datetime]
    created_by: str

    class Config:
        from_attributes = True


class StatusHistoryBase(BaseModel):
    from_status: Optional[str] = Field(None, description="原状态")
    to_status: str = Field(..., description="新状态")
    change_reason: str = Field(..., description="变更原因")
    operator: str = Field(..., description="操作者")
    remark: Optional[str] = Field(None, description="备注")


class StatusHistoryResponse(StatusHistoryBase):
    id: int
    record_id: int
    change_time: datetime

    class Config:
        from_attributes = True


class ImportEvidenceResponse(BaseModel):
    id: int
    record_id: int
    source_file_name: str
    source_file_path: str
    source_row_number: int
    original_raw_value: Dict[str, Any]
    parsed_standard_value: Dict[str, Any]
    is_manual_corrected: bool
    correction_history: Optional[List[Dict[str, Any]]]
    imported_at: datetime
    imported_by: str

    class Config:
        from_attributes = True


class AsyncTaskBase(BaseModel):
    task_type: str = Field(..., description="任务类型")
    task_params: Optional[Dict[str, Any]] = Field(None, description="任务参数")
    created_by: str = Field(..., description="创建人")


class AsyncTaskResponse(BaseModel):
    id: int
    task_id: str
    task_type: str
    status: TaskStatus
    retry_count: int
    max_retry_count: int
    next_retry_time: Optional[datetime]
    error_message: Optional[str]
    task_result: Optional[Dict[str, Any]]
    created_by: str
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class ReplayExceptionBase(BaseModel):
    exception_type: str = Field(..., description="异常类型")
    description: str = Field(..., description="异常描述")
    related_record_ids: Optional[List[int]] = Field(None, description="关联记录ID")


class ReplayExceptionResolve(BaseModel):
    resolution: str = Field(..., description="处理方案")
    resolved_by: str = Field(..., description="处理人")
    after_correction: Optional[Dict[str, Any]] = Field(None, description="修正后数据")


class ReplayExceptionResponse(BaseModel):
    id: int
    exception_code: str
    exception_type: str
    description: str
    related_record_ids: Optional[List[int]]
    status: str
    resolution: Optional[str]
    resolved_by: Optional[str]
    resolved_at: Optional[datetime]
    before_correction: Optional[Dict[str, Any]]
    after_correction: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    record_id: Optional[int]
    action: str
    module: str
    operator: str
    action_time: datetime
    ip_address: Optional[str]
    request_params: Optional[Dict[str, Any]]
    before_data: Optional[Dict[str, Any]]
    after_data: Optional[Dict[str, Any]]
    diff_data: Optional[Dict[str, Any]]
    remark: Optional[str]

    class Config:
        from_attributes = True


class ImportResult(BaseModel):
    success_count: int
    duplicate_count: int
    failed_count: int
    failed_records: List[Dict[str, Any]]


class StatusChangeRequest(BaseModel):
    new_status: ConsumableStatus = Field(..., description="新状态")
    change_reason: str = Field(..., description="变更原因")
    operator: str = Field(..., description="操作者")
    remark: Optional[str] = Field(None, description="备注")


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[Any]
