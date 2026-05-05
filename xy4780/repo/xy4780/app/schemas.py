from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from app.config import ApplicationStatus, UserRole


class ApplicationCreate(BaseModel):
    applicant_id: int = Field(..., gt=0, description="申请人ID")
    applicant_name: str = Field(..., min_length=1, max_length=100, description="申请人姓名")
    department: Optional[str] = Field(None, max_length=100, description="所属部门")
    project_name: str = Field(..., min_length=1, max_length=200, description="项目名称")
    project_description: Optional[str] = Field(None, description="项目描述")
    dataset_id: str = Field(..., min_length=1, max_length=50, description="数据集ID")
    dataset_name: str = Field(..., min_length=1, max_length=200, description="数据集名称")


class ApplicationUpdate(BaseModel):
    project_name: Optional[str] = Field(None, min_length=1, max_length=200)
    project_description: Optional[str] = Field(None)
    dataset_name: Optional[str] = Field(None, min_length=1, max_length=200)
    ethics_approval_file_id: Optional[int] = Field(None, gt=0, description="伦理批件文件ID")
    ethics_approval_date: Optional[datetime] = Field(None, description="伦理批准日期")


class StatusTransitionRequest(BaseModel):
    operator_id: int = Field(..., gt=0, description="操作者ID")
    operator_name: str = Field(..., min_length=1, max_length=100, description="操作者姓名")
    operator_role: UserRole = Field(..., description="操作者角色")
    reason: Optional[str] = Field(None, max_length=1000, description="状态变更原因")
    idempotent_key: str = Field(..., min_length=1, max_length=100, description="幂等键")
    current_version: int = Field(..., ge=1, description="当前版本号，用于乐观锁")


class SubmitForEthicsReviewRequest(StatusTransitionRequest):
    pass


class EthicsReviewRequest(StatusTransitionRequest):
    approved: bool = Field(..., description="是否通过伦理审核")
    reviewer_comments: Optional[str] = Field(None, max_length=1000, description="审核意见")
    ethics_approval_file_id: Optional[int] = Field(None, gt=0, description="伦理批件文件ID（如之前未上传）")
    ethics_approval_date: Optional[datetime] = Field(None, description="伦理批准日期")


class DeidentificationReviewRequest(StatusTransitionRequest):
    passed: bool = Field(..., description="脱敏复核是否通过")
    reviewer_comments: Optional[str] = Field(None, max_length=1000, description="复核意见")
    deidentification_report_id: Optional[int] = Field(None, gt=0, description="脱敏报告文件ID")


class MakeAvailableRequest(StatusTransitionRequest):
    download_url: str = Field(..., min_length=1, max_length=500, description="下载链接")
    download_expiry_days: int = Field(7, ge=1, le=365, description="下载链接有效期（天）")


class RevokeRequest(StatusTransitionRequest):
    reason: str = Field(..., min_length=1, max_length=1000, description="撤销原因")


class ExpireRequest(StatusTransitionRequest):
    reason: Optional[str] = Field(None, max_length=1000, description="过期原因")


class ApplicationResponse(BaseModel):
    id: int
    applicant_id: int
    applicant_name: str
    department: Optional[str]
    project_name: str
    project_description: Optional[str]
    dataset_id: str
    dataset_name: str
    status: ApplicationStatus
    version: int
    ethics_approval_file_id: Optional[int]
    ethics_approval_date: Optional[datetime]
    ethics_reviewer_id: Optional[int]
    ethics_reviewer_name: Optional[str]
    ethics_comments: Optional[str]
    deidentification_report_id: Optional[int]
    deidentification_passed: int
    deidentification_reviewer_id: Optional[int]
    deidentification_reviewer_name: Optional[str]
    deidentification_comments: Optional[str]
    download_url: Optional[str]
    download_expiry_date: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    application_id: int
    operator_id: int
    operator_name: str
    operator_role: UserRole
    action: str
    from_status: Optional[ApplicationStatus]
    to_status: Optional[ApplicationStatus]
    reason: Optional[str]
    idempotent_key: Optional[str]
    version: int
    created_at: datetime

    class Config:
        from_attributes = True


class IdempotentResponse(BaseModel):
    idempotent_key: str
    processed: bool
    result_status: Optional[ApplicationStatus]
    message: str


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[dict] = None


class SuccessResponse(BaseModel):
    success: bool = True
    message: str
    data: Optional[dict] = None
