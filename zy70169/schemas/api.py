from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ModelVersionCreate(BaseModel):
    model_name: str = Field(..., description="模型名称，例如：推荐算法模型")
    version: str = Field(..., description="版本号，例如：v1.2.3")
    description: Optional[str] = Field(None, description="版本说明")


class ModelVersionResponse(BaseModel):
    id: int
    model_name: str
    version: str
    description: Optional[str]
    current_status: str
    created_at: datetime
    is_rolled_back: bool
    traffic_weight: int
    is_production: bool
    
    class Config:
        from_attributes = True


class ModelVersionDetail(ModelVersionResponse):
    rollback_reason: Optional[str]
    rollback_at: Optional[datetime]


class EvaluationCreate(BaseModel):
    evaluator: str = Field(..., description="评测人姓名或账号")
    accuracy_score: str = Field(..., description="准确率得分，例如：95.2%")
    performance_score: str = Field(..., description="性能得分，例如：98ms")
    stability_score: str = Field(..., description="稳定性得分，例如：优秀")
    overall_result: str = Field(..., description="综合结论：通过 / 不通过")
    findings: Optional[str] = Field(None, description="评测发现的问题或亮点")


class EvaluationResponse(BaseModel):
    id: int
    evaluator: str
    accuracy_score: str
    performance_score: str
    stability_score: str
    overall_result: str
    findings: Optional[str]
    evaluated_at: datetime
    
    class Config:
        from_attributes = True


class ApprovalCreate(BaseModel):
    approver: str = Field(..., description="审批人姓名或账号")
    approval_type: str = Field(..., description="审批类型：灰度审批 / 正式发布审批")
    decision: str = Field(..., description="审批结论：通过 / 驳回")
    comments: Optional[str] = Field(None, description="审批意见")


class ApprovalResponse(BaseModel):
    id: int
    approver: str
    approval_type: str
    decision: str
    comments: Optional[str]
    approved_at: datetime
    
    class Config:
        from_attributes = True


class TrafficSwitch(BaseModel):
    operator: str = Field(..., description="操作人姓名或账号")
    traffic_weight: int = Field(..., ge=0, le=100, description="流量比例，0-100")
    reason: str = Field(..., description="切换流量的原因")


class RollbackRequest(BaseModel):
    operator: str = Field(..., description="操作人姓名或账号")
    reason: str = Field(..., description="回滚原因说明")


class StatusHistoryResponse(BaseModel):
    id: int
    from_status: Optional[str]
    to_status: str
    operator: str
    reason: Optional[str]
    changed_at: datetime
    
    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    action: str
    operator: str
    details: Optional[str]
    result: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None
    next_step: Optional[str] = None


class SummaryResponse(BaseModel):
    total_models: int
    pending_evaluation: int
    pending_approval: int
    in_grayscale: int
    in_production: int
    rolled_back: int
    recent_activities: List[AuditLogResponse]


class ModelVersionFullDetail(BaseModel):
    basic_info: ModelVersionDetail
    evaluations: List[EvaluationResponse]
    approvals: List[ApprovalResponse]
    history: List[StatusHistoryResponse]
    audits: List[AuditLogResponse]
    next_step: Optional[str]
