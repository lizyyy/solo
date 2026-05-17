from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator


class RejectionReason(str, Enum):
    BARCODE_DUPLICATE = "条码重复"
    BARCODE_MISSING = "条码缺失"
    BARCODE_INVALID = "条码无效"
    TIME_EXPIRED = "超时接收"
    TIME_INVALID = "采样时间无效"
    TRANSPORTER_MISSING = "运输人缺失"
    SAMPLE_DAMAGED = "样本破损"
    SAMPLE_LEAKING = "样本泄漏"
    DOCUMENT_INCOMPLETE = "单据不全"
    TEMPERATURE_ABNORMAL = "温度异常"
    OTHER = "其他"


class ApprovalStatus(str, Enum):
    PENDING = "待审批"
    APPROVED = "已批准"
    REJECTED = "已拒绝"


class SampleRecord(BaseModel):
    barcode: str = Field(..., description="样本条码")
    sampling_time: Optional[datetime] = Field(None, description="采样时间")
    transporter: Optional[str] = Field(None, description="运输人")
    transport_batch: Optional[str] = Field(None, description="运输批次")
    receive_time: Optional[datetime] = Field(None, description="接收时间")
    receive_window: Optional[str] = Field(None, description="接收窗口")
    rejection_reason: Optional[RejectionReason] = Field(None, description="拒收原因")
    rejection_note: Optional[str] = Field(None, description="拒收备注")
    is_rejected: bool = Field(False, description="是否拒收")
    approval_status: ApprovalStatus = Field(ApprovalStatus.PENDING, description="审批状态")
    approval_time: Optional[datetime] = Field(None, description="审批时间")
    approver: Optional[str] = Field(None, description="审批人")
    source_file: str = Field(..., description="来源文件")
    source_row: int = Field(..., description="来源行号")
    raw_data: Dict[str, Any] = Field(default_factory=dict, description="原始数据")
    errors: List[str] = Field(default_factory=list, description="错误列表")
    warnings: List[str] = Field(default_factory=list, description="警告列表")
    is_valid: bool = Field(True, description="是否有效记录")

    class Config:
        arbitrary_types_allowed = True

    @validator('barcode')
    def barcode_must_not_be_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("条码不能为空")
        return v.strip()


class ValidationResult(BaseModel):
    total_records: int = 0
    valid_records: int = 0
    invalid_records: int = 0
    rejected_records: int = 0
    pending_approval: int = 0
    barcode_duplicates: List[str] = Field(default_factory=list)
    time_expired: List[str] = Field(default_factory=list)
    error_details: Dict[str, List[str]] = Field(default_factory=dict)


class HandoverReport(BaseModel):
    report_id: str
    generated_at: datetime
    validation_result: ValidationResult
    records: List[SampleRecord]
    summary: Dict[str, Any] = Field(default_factory=dict)
