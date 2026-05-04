from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime


class ReviewRequest(BaseModel):
    detection_id: int = Field(..., description="检测记录ID")
    hit_record_id: Optional[int] = Field(None, description="命中记录ID(可选，针对特定命中)")
    review_result: str = Field(..., description="复核结果: false_positive/confirmed/needs_review")
    reviewer: Optional[str] = Field(None, description="复核人")
    comment: Optional[str] = Field(None, description="复核意见")
    add_to_whitelist: bool = Field(default=False, description="是否添加到白名单")
    add_to_sensitive_words: bool = Field(default=False, description="是否添加到敏感词库")


class FalsePositiveRequest(BaseModel):
    detection_id: int
    hit_record_id: Optional[int] = None
    reason: str = Field(..., min_length=1, description="误报原因")
    reviewer: Optional[str] = None
    add_to_whitelist: bool = Field(default=True)


class ConfirmSensitiveRequest(BaseModel):
    detection_id: int
    hit_record_id: Optional[int] = None
    comment: Optional[str] = None
    reviewer: Optional[str] = None
    add_to_sensitive_words: bool = Field(default=False)
    new_sensitive_word: Optional[str] = Field(None, description="新敏感词(如果添加到词库)")


class ReviewResponse(BaseModel):
    id: int
    detection_id: int
    hit_record_id: Optional[int]
    review_type: str
    review_result: str
    reviewer: Optional[str]
    comment: Optional[str]
    action_taken: Optional[str]
    added_to_whitelist: bool
    whitelist_term: Optional[str]
    added_to_sensitive_words: bool
    sensitive_word: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True
