from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models.models import CodeStatus, BindingStatus, ExceptionType, TaskType, TaskStatus


class CodeCreate(BaseModel):
    count: int = Field(..., gt=0, description="生成溯源码数量")
    cooperative_id: Optional[str] = Field(None, description="合作社ID")


class CodeIssue(BaseModel):
    codes: List[str] = Field(..., description="要发放的溯源码列表")
    farmer_id: str = Field(..., description="农户ID")
    cooperative_id: str = Field(..., description="合作社ID")


class CodeRecycle(BaseModel):
    codes: List[str] = Field(..., description="要回收的溯源码列表")


class CodeResponse(BaseModel):
    id: int
    code: str
    status: str
    cooperative_id: Optional[str]
    farmer_id: Optional[str]
    issued_at: Optional[datetime]
    recycled_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class CodeListResponse(BaseModel):
    codes: List[CodeResponse]
    total: int


class BatchCreate(BaseModel):
    batch_number: str = Field(..., description="批次号")
    cooperative_id: str = Field(..., description="合作社ID")
    farmer_id: str = Field(..., description="农户ID")
    product_name: str = Field(..., description="产品名称")
    harvest_date: datetime = Field(..., description="采摘日期")
    quantity: int = Field(..., gt=0, description="数量")
    unit: str = Field(..., description="单位")


class BatchResponse(BaseModel):
    id: int
    batch_number: str
    cooperative_id: str
    farmer_id: str
    product_name: str
    harvest_date: datetime
    quantity: int
    unit: str
    created_at: datetime

    class Config:
        from_attributes = True


class BatchListResponse(BaseModel):
    batches: List[BatchResponse]
    total: int


class CodeBatchBind(BaseModel):
    codes: List[str] = Field(..., description="要绑定的溯源码列表")
    batch_id: int = Field(..., description="批次ID")


class CodeBatchUnbind(BaseModel):
    codes: List[str] = Field(..., description="要解绑的溯源码列表")


class BindingResponse(BaseModel):
    id: int
    code_id: int
    batch_id: int
    status: str
    bound_at: datetime
    unbound_at: Optional[datetime]

    class Config:
        from_attributes = True


class InspectionReportCreate(BaseModel):
    report_number: str = Field(..., description="报告编号")
    batch_id: Optional[int] = Field(None, description="批次ID")
    inspector: str = Field(..., description="检测员")
    inspection_date: datetime = Field(..., description="检测日期")
    result: str = Field(..., description="检测结果")
    details: Optional[str] = Field(None, description="详细信息")


class InspectionReportResponse(BaseModel):
    id: int
    report_number: str
    batch_id: Optional[int]
    inspector: str
    inspection_date: datetime
    result: str
    details: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ReportListResponse(BaseModel):
    reports: List[InspectionReportResponse]
    total: int


class ScanResponse(BaseModel):
    code: str
    code_status: str
    batch: Optional[BatchResponse]
    reports: List[InspectionReportResponse]
    scanned_at: datetime


class ExceptionRecordResponse(BaseModel):
    id: int
    exception_type: str
    operation: str
    data: Optional[str]
    error_message: str
    resolved: bool
    resolved_at: Optional[datetime]
    resolved_by: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ExceptionListResponse(BaseModel):
    records: List[ExceptionRecordResponse]
    total: int


class PendingTaskResponse(BaseModel):
    id: int
    task_type: str
    title: str
    description: Optional[str]
    data: Optional[str]
    assigned_to: Optional[str]
    completed: bool
    completed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class TaskListResponse(BaseModel):
    tasks: List[PendingTaskResponse]
    total: int


class BackgroundJobResponse(BaseModel):
    id: int
    job_type: str
    status: str
    retry_count: int
    max_retries: int
    error_message: Optional[str]
    last_executed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class JobListResponse(BaseModel):
    jobs: List[BackgroundJobResponse]
    total: int


class AntiCounterfeitingReport(BaseModel):
    total_codes: int
    available_codes: int
    issued_codes: int
    bound_codes: int
    recycled_codes: int
    invalid_codes: int
    total_batches: int
    total_reports: int
    total_scans: int
    pending_tasks: int
    unresolved_exceptions: int
