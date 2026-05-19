from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator

from app.models.review import ReviewResult
from app.schemas.common import SensitiveBaseModel


class ReviewBase(SensitiveBaseModel):
    hazard_id: int = Field(..., description="关联隐患ID")
    reviewer: Optional[str] = Field(None, max_length=100, description="复查人")
    reviewer_phone: Optional[str] = Field(None, max_length=20, description="复查人电话")
    reviewed_at: Optional[datetime] = Field(default_factory=datetime.utcnow, description="复查时间")
    result: ReviewResult = Field(..., description="复查结果")
    comments: Optional[str] = Field(None, max_length=2000, description="复查意见")
    suggestions: Optional[str] = Field(None, max_length=2000, description="改进建议")
    next_review_date: Optional[datetime] = Field(None, description="下次复查时间")

    @field_validator('reviewer_phone')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            return v
        if not v.replace('-', '').replace(' ', '').isdigit():
            raise ValueError("电话号码只能包含数字、横线和空格")
        return v


class ReviewCreate(ReviewBase):
    pass


class ReviewUpdate(ReviewBase):
    hazard_id: Optional[int] = None


class ReviewInDB(ReviewBase):
    id: int
    is_passed: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class Review(ReviewInDB):
    pass
