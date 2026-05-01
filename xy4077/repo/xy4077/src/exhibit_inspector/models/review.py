"""人工复核记录模型"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ReviewStatus(str, Enum):
    """复核状态"""
    PENDING = "pending"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_CLARIFICATION = "needs_clarification"


class ReviewConclusion(str, Enum):
    """复核结论"""
    ACCEPTABLE = "acceptable"
    ACCEPTABLE_WITH_COMMENTS = "acceptable_with_comments"
    UNACCEPTABLE = "unacceptable"
    REQUIRES_FURTHER_INVESTIGATION = "requires_further_investigation"


class ReviewRecord(BaseModel):
    """复核记录"""
    review_id: str = Field(..., description="复核记录唯一标识")
    issue_id: str = Field(..., description="关联的问题编号")
    reviewer: str = Field(..., description="复核人")
    review_time: str = Field(..., description="复核时间，ISO 格式")
    status: ReviewStatus = Field(..., description="复核状态")
    conclusion: Optional[ReviewConclusion] = Field(None, description="复核结论")
    comments: Optional[str] = Field(None, description="复核意见")
    actions_required: Optional[list[str]] = Field(None, description="需要采取的行动")
    attachments: Optional[list[str]] = Field(None, description="附件列表")
    follow_up_reviewer: Optional[str] = Field(None, description="后续复核人")
    follow_up_deadline: Optional[str] = Field(None, description="后续截止时间")
    created_at: str = Field(..., description="创建时间，ISO 格式")
    updated_at: Optional[str] = Field(None, description="更新时间，ISO 格式")
