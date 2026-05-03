from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class ApprovalStatusEnum(str, Enum):
    DRAFT = "草稿"
    PENDING = "待审核"
    APPROVED = "已审签"
    REJECTED = "已驳回"
    CANCELLED = "已撤销"

class ConflictTypeEnum(str, Enum):
    TRACK_CONFLICT = "轨行区重复占用"
    POWER_CONFLICT = "停电窗口不匹配"
    TRAIN_CONFLICT = "作业车相向冲突"
    QUALIFICATION_CONFLICT = "人员资质过期"
    TIME_OVERLAP = "时间窗口重叠"

class ImportStatusEnum(str, Enum):
    PENDING = "待处理"
    SUCCESS = "已成功"
    FAILED = "已失败"
    PARTIAL = "部分成功"

class ApiResponse(BaseModel):
    success: bool = True
    message: str = "操作成功"
    data: Optional[Any] = None
    errors: Optional[List[str]] = None

class ImportResponse(BaseModel):
    success: bool
    message: str
    import_id: int
    file_type: str
    file_name: str
    total_records: int
    success_records: int
    status: str
    errors: Optional[List[Dict]] = None

class ConflictCheckResult(BaseModel):
    plan_id: int
    plan_no: str
    total_conflicts: int
    risk_summary: Dict[str, int]
    can_approve: bool
    details: Dict[str, Any]
    conflicts: List[Dict[str, Any]]

class RiskStatistics(BaseModel):
    total_conflicts: int
    unresolved: int
    resolved: int
    risk_summary: Dict[str, int]
    type_summary: Dict[str, int]
    high_risk_plans: List[Dict[str, Any]]

class SubmitApprovalRequest(BaseModel):
    plan_id: int
    submitter: str = Field(..., description="提交人")
    comments: Optional[str] = None

class ApproveRequest(BaseModel):
    plan_id: int
    approver: str = Field(..., description="审批人")
    comments: Optional[str] = None
    force_approve: bool = Field(default=False, description="是否强制审签（跳过冲突检查）")

class RejectRequest(BaseModel):
    plan_id: int
    approver: str = Field(..., description="审批人")
    comments: str = Field(..., description="驳回原因")

class CancelRequest(BaseModel):
    plan_id: int
    operator: str = Field(..., description="操作人")
    reason: str = Field(..., description="撤销原因")

class ApprovalActionResponse(BaseModel):
    success: bool
    plan_id: int
    plan_no: Optional[str] = None
    status: str
    message: str
    approval_record_id: Optional[int] = None

class ExportResponse(BaseModel):
    success: bool
    message: str
    file_name: str
    file_path: str
    file_size: int
    export_time: datetime

class DailyReportRequest(BaseModel):
    report_date: Optional[str] = Field(default=None, description="报告日期，格式：YYYY-MM-DD，默认今天")
    format: str = Field(default="markdown", description="导出格式：markdown 或 csv")
