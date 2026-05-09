from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class CreateSubstitutionRequest(BaseModel):
    original_code: str = Field(..., description="原原料编码，如 RM-001")
    substitute_code: str = Field(..., description="替代原料编码，如 RM-002")
    reason: str = Field(..., description="替代原因，业务语言描述")
    created_by: str = Field(..., description="申请人")
    substitute_ratio: float = Field(default=1.0, description="替代比例，默认 1.0 即 1:1 替代")
    is_temporary: bool = Field(default=True, description="是否为临时替代")


class SubmitApprovalRequest(BaseModel):
    request_no: str = Field(..., description="申请单号")
    submitter: str = Field(..., description="提交人")


class ApprovalRequest(BaseModel):
    request_no: str = Field(..., description="申请单号")
    approver: str = Field(..., description="审批人")
    level: str = Field(..., description="审批级别：QC（质检）、COST（成本）、FINAL（最终）")
    result: str = Field(..., description="审批结果：APPROVE（通过）、REJECT（驳回）、DEFER（暂缓）")
    comment: Optional[str] = Field(default="", description="审批意见")


class FreezeRequest(BaseModel):
    request_no: str = Field(..., description="申请单号")
    operator: str = Field(..., description="操作人")
    reason: str = Field(..., description="冻结原因")


class ExecuteRequest(BaseModel):
    request_no: str = Field(..., description="申请单号")
    operator: str = Field(..., description="执行人")
    simulate_failure: Optional[int] = Field(
        default=-1, 
        description="模拟失败的配方索引（用于测试重试机制），-1 表示不模拟"
    )


class UnfreezeRequest(BaseModel):
    request_no: str = Field(..., description="申请单号")
    operator: str = Field(..., description="操作人")
