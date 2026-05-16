from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models import CompensationStatus, CompensationStrategy


class CompensationRecordCreate(BaseModel):
    queue_name: str = Field(..., description="队列名称")
    message_id: str = Field(..., description="消息编号")
    business_no: str = Field(..., description="业务单据号")
    strategy: CompensationStrategy = Field(default=CompensationStrategy.RETRY_THREE, description="补偿策略")
    original_input: Dict[str, Any] = Field(..., description="原始输入")
    batch_id: Optional[str] = Field(None, description="批次ID")


class CompensationRecordUpdate(BaseModel):
    status: Optional[CompensationStatus] = None
    process_basis: Optional[str] = None
    final_conclusion: Optional[str] = None
    error_message: Optional[str] = None
    operator: Optional[str] = "system"
    remark: Optional[str] = None


class CompensationRecordResponse(BaseModel):
    id: int
    queue_name: str
    message_id: str
    business_no: str
    status: CompensationStatus
    strategy: CompensationStrategy
    retry_count: int
    max_retry: int
    original_input: Dict[str, Any]
    process_basis: Optional[str]
    final_conclusion: Optional[str]
    error_message: Optional[str]
    batch_id: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    processed_at: Optional[datetime]

    class Config:
        orm_mode = True


class CompensationHistoryResponse(BaseModel):
    id: int
    record_id: int
    from_status: Optional[str]
    to_status: str
    operation_type: str
    operator: str
    remark: Optional[str]
    created_at: datetime

    class Config:
        orm_mode = True


class CompensationBatchResponse(BaseModel):
    id: int
    batch_id: str
    queue_name: str
    total_count: int
    success_count: int
    failed_count: int
    skipped_count: int
    status: str
    created_at: datetime
    finished_at: Optional[datetime]

    class Config:
        orm_mode = True


class CompensationReportResponse(BaseModel):
    id: int
    report_id: str
    batch_id: Optional[str]
    queue_name: Optional[str]
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    total_count: int
    success_count: int
    failed_count: int
    skipped_count: int
    file_path: Optional[str]
    created_by: str
    created_at: datetime

    class Config:
        orm_mode = True


class ManualFixRequest(BaseModel):
    business_no: str = Field(..., description="业务单据号")
    final_conclusion: str = Field(..., description="最终处理结论")
    process_basis: str = Field(..., description="处理依据")
    operator: str = Field(..., description="操作人")


class BatchCreateRequest(BaseModel):
    queue_name: str = Field(..., description="队列名称")
    records: List[CompensationRecordCreate] = Field(..., description="补偿记录列表")


class QueryRequest(BaseModel):
    queue_name: Optional[str] = None
    business_no: Optional[str] = None
    status: Optional[CompensationStatus] = None
    batch_id: Optional[str] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[CompensationRecordResponse]


class ExportRequest(BaseModel):
    queue_name: Optional[str] = None
    batch_id: Optional[str] = None
    status: Optional[CompensationStatus] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
