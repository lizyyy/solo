from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional, List


class ImageProvenanceCreate(BaseModel):
    image_tag: str = Field(..., description="镜像标签")
    image_digest: Optional[str] = Field(None, description="镜像digest")
    pipeline_id: str = Field(..., description="构建流水线ID")
    pipeline_name: Optional[str] = Field(None, description="构建流水线名称")
    pipeline_url: Optional[str] = Field(None, description="构建流水线链接")
    commit_hash: str = Field(..., description="源码提交哈希")
    commit_branch: Optional[str] = Field(None, description="源码分支")
    commit_message: Optional[str] = Field(None, description="提交信息")
    commit_author: Optional[str] = Field(None, description="提交作者")
    commit_url: Optional[str] = Field(None, description="提交链接")
    signer: Optional[str] = Field(None, description="签名者")
    signature: Optional[str] = Field(None, description="签名内容")
    signature_algorithm: str = Field("sha256-rsa", description="签名算法")


class ImageProvenanceUpdate(BaseModel):
    signature: Optional[str] = Field(None, description="签名内容")
    signer: Optional[str] = Field(None, description="签名者")
    signature_verified: Optional[bool] = Field(None)
    status: Optional[str] = Field(None)


class ExceptionRequest(BaseModel):
    reason: str = Field(..., description="例外申请原因")
    requester: str = Field(..., description="申请人")


class ExceptionApproval(BaseModel):
    approved: bool = Field(..., description="是否批准")
    approver: str = Field(..., description="审批人")
    reason: Optional[str] = Field(None, description="审批意见")


class ImageProvenanceResponse(BaseModel):
    id: int
    image_tag: str
    image_digest: Optional[str]
    pipeline_id: str
    pipeline_name: Optional[str]
    pipeline_url: Optional[str]
    commit_hash: str
    commit_branch: Optional[str]
    commit_message: Optional[str]
    commit_author: Optional[str]
    commit_url: Optional[str]
    signer: Optional[str]
    signature: Optional[str]
    signature_algorithm: str
    signature_verified: bool
    verification_time: Optional[datetime]
    status: str
    exception_requested: bool
    exception_approved: bool
    exception_approver: Optional[str]
    exception_reason: Optional[str]
    exception_time: Optional[datetime]
    provenance_bundle_path: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[dict] = None


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[ImageProvenanceResponse]
