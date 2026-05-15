from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class AuditStatus(str, Enum):
    PASS = "pass"
    FAIL = "fail"
    WARNING = "warning"
    PARTIAL = "partial"
    PENDING = "pending"


class CorrectionNote(BaseModel):
    corrector: str = Field(..., description="修正人")
    correction_time: datetime = Field(default_factory=datetime.now)
    original_judgment: AuditStatus
    corrected_judgment: AuditStatus
    reason: str = Field(..., description="修正理由")
    evidence: Optional[str] = Field(None, description="佐证材料链接")


class AuditItem(BaseModel):
    item_id: str = Field(..., description="审计项ID")
    item_name: str = Field(..., description="审计项名称")
    category: str = Field(..., description="审计类别")
    responsible_person: Optional[str] = Field(None, description="负责人")
    department: str = Field(..., description="所属部门")
    environment_name: str = Field(..., description="环境名称")
    source: str = Field(..., description="数据来源")
    status: AuditStatus = Field(default=AuditStatus.PENDING)
    error_message: Optional[str] = Field(None)
    check_time: Optional[datetime] = None
    correction_notes: List[CorrectionNote] = Field(default_factory=list)
    original_data: Dict[str, Any] = Field(default_factory=dict, description="原始输入数据")
    processing_basis: List[str] = Field(default_factory=list, description="处理依据")


class AuditResult(BaseModel):
    environment_name: str
    total_count: int
    pass_count: int
    fail_count: int
    warning_count: int
    pending_count: int
    overall_status: AuditStatus
    items: List[AuditItem]
    report_time: datetime = Field(default_factory=datetime.now)


class ErrorCode(str, Enum):
    SUCCESS = "0"
    MISSING_RESPONSIBLE = "E001"
    INVALID_DATA = "E002"
    FILE_NOT_FOUND = "E003"
    PARTIAL_SUCCESS = "E004"
    UNKNOWN_ERROR = "E999"


class AuditError(BaseModel):
    code: ErrorCode
    message: str
    details: Optional[Dict[str, Any]] = None
