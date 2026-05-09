from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from models import ApplicationStatus, MaterialStatus, CorrectionTaskStatus


class MaterialBase(BaseModel):
    name: str = Field(..., description="材料名称")
    code: str = Field(..., description="材料编码")
    category: Optional[str] = Field(None, description="材料分类")
    description: Optional[str] = Field(None, description="材料描述")
    required: Optional[str] = Field("必填", description="是否必填")
    format: Optional[str] = Field(None, description="材料格式")
    page_count: Optional[int] = Field(1, description="页数")


class MaterialCreate(MaterialBase):
    pass


class MaterialUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    required: Optional[str] = None
    format: Optional[str] = None
    page_count: Optional[int] = None


class MaterialResponse(MaterialBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReviewRuleBase(BaseModel):
    material_id: int = Field(..., description="关联材料ID")
    rule_name: str = Field(..., description="规则名称")
    rule_type: str = Field(..., description="规则类型")
    rule_content: str = Field(..., description="规则内容")
    priority: Optional[int] = Field(1, description="优先级")
    is_active: Optional[int] = Field(1, description="是否启用")


class ReviewRuleCreate(ReviewRuleBase):
    pass


class ReviewRuleUpdate(BaseModel):
    rule_name: Optional[str] = None
    rule_type: Optional[str] = None
    rule_content: Optional[str] = None
    priority: Optional[int] = None
    is_active: Optional[int] = None


class ReviewRuleResponse(ReviewRuleBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ApplicationMaterialBase(BaseModel):
    material_id: int = Field(..., description="材料目录ID")
    material_name: str = Field(..., description="材料名称")
    file_name: Optional[str] = Field(None, description="文件名")
    file_size: Optional[int] = Field(None, description="文件大小")


class ApplicationMaterialCreate(ApplicationMaterialBase):
    pass


class ApplicationMaterialUpdate(BaseModel):
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    status: Optional[MaterialStatus] = None
    review_result: Optional[str] = None


class ApplicationMaterialResponse(ApplicationMaterialBase):
    id: int
    application_id: int
    status: MaterialStatus
    review_result: Optional[str] = None
    review_time: Optional[datetime] = None
    reviewer: Optional[str] = None
    uploaded_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ApplicationBase(BaseModel):
    applicant_name: str = Field(..., description="申请人姓名")
    applicant_id: Optional[str] = Field(None, description="申请人证件号")
    business_type: Optional[str] = Field(None, description="业务类型")


class ApplicationCreate(ApplicationBase):
    materials: List[ApplicationMaterialCreate] = Field(..., description="申请材料列表")


class ApplicationUpdate(BaseModel):
    applicant_name: Optional[str] = None
    applicant_id: Optional[str] = None
    business_type: Optional[str] = None


class ApplicationResponse(ApplicationBase):
    id: int
    application_no: Optional[str] = None
    status: ApplicationStatus
    current_step: Optional[str] = None
    submit_time: Optional[datetime] = None
    accept_time: Optional[datetime] = None
    complete_time: Optional[datetime] = None
    reject_reason: Optional[str] = None
    materials: List[ApplicationMaterialResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ApplicationStatusHistoryResponse(BaseModel):
    id: int
    from_status: Optional[str] = None
    to_status: str
    reason: Optional[str] = None
    operator: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CorrectionTaskBase(BaseModel):
    application_id: int = Field(..., description="办件ID")
    application_material_id: int = Field(..., description="申请材料ID")
    task_name: str = Field(..., description="任务名称")
    correction_content: str = Field(..., description="补正内容")
    assignee: Optional[str] = Field(None, description="负责人")
    due_date: Optional[datetime] = Field(None, description="截止日期")


class CorrectionTaskCreate(CorrectionTaskBase):
    pass


class CorrectionTaskUpdate(BaseModel):
    task_name: Optional[str] = None
    correction_content: Optional[str] = None
    status: Optional[CorrectionTaskStatus] = None
    assignee: Optional[str] = None
    due_date: Optional[datetime] = None


class CorrectionTaskResponse(CorrectionTaskBase):
    id: int
    status: CorrectionTaskStatus
    completed_at: Optional[datetime] = None
    retry_count: int
    last_error: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RejectReasonBase(BaseModel):
    code: str = Field(..., description="原因编码")
    name: str = Field(..., description="原因名称")
    description: Optional[str] = Field(None, description="原因描述")
    category: Optional[str] = Field(None, description="分类")
    is_active: Optional[int] = Field(1, description="是否启用")


class RejectReasonCreate(RejectReasonBase):
    pass


class RejectReasonResponse(RejectReasonBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class SubmitApplicationRequest(BaseModel):
    application_id: int = Field(..., description="办件ID")


class ReviewMaterialRequest(BaseModel):
    application_material_id: int = Field(..., description="申请材料ID")
    status: MaterialStatus = Field(..., description="审核结果状态")
    review_result: Optional[str] = Field(None, description="审核结果说明")
    reviewer: Optional[str] = Field(None, description="审核人")


class RejectApplicationRequest(BaseModel):
    application_id: int = Field(..., description="办件ID")
    reject_reason: str = Field(..., description="退回原因")
    operator: Optional[str] = Field(None, description="操作人")


class AcceptApplicationRequest(BaseModel):
    application_id: int = Field(..., description="办件ID")
    operator: Optional[str] = Field(None, description="操作人")


class RetryCorrectionTaskRequest(BaseModel):
    task_id: int = Field(..., description="补正任务ID")
    operator: Optional[str] = Field(None, description="操作人")


class ApplicationSummary(BaseModel):
    total: int = 0
    draft: int = 0
    submitted: int = 0
    under_review: int = 0
    needs_correction: int = 0
    corrected: int = 0
    rejected: int = 0
    accepted: int = 0
    completed: int = 0


class CorrectionTaskSummary(BaseModel):
    total: int = 0
    pending: int = 0
    in_progress: int = 0
    completed: int = 0
    failed: int = 0
