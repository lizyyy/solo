from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime


class CompareDetailResponse(BaseModel):
    id: int
    detail_type: str
    standard_part: Optional[str]
    meeting_part: Optional[str]
    diff_content: Optional[str]
    similarity: float
    remark: Optional[str]
    created_at: datetime
    user_friendly_message: str = "获取比对详情成功～"

    class Config:
        from_attributes = True


class CompareBase(BaseModel):
    meeting_id: int = Field(..., description="会议ID")
    knowledge_id: Optional[int] = Field(None, description="知识库ID")


class CompareRequest(CompareBase):
    auto_match: bool = Field(default=True, description="是否自动匹配知识库")
    threshold: Optional[float] = Field(None, description="相似度阈值")


class CompareResultResponse(BaseModel):
    id: int
    meeting_id: int
    knowledge_id: Optional[int]
    knowledge_version: Optional[str]
    question: str
    standard_answer: Optional[str]
    meeting_answer: Optional[str]
    similarity: float
    is_match: bool
    status: str
    error_type: Optional[str]
    confidence: float
    is_affected_by_version: bool
    affected_version: Optional[str]
    details: List[CompareDetailResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    user_friendly_message: str = "获取比对结果成功～"

    class Config:
        from_attributes = True


class CompareResultListItem(BaseModel):
    id: int
    meeting_id: int
    question: str
    similarity: float
    is_match: bool
    status: str
    error_type: Optional[str]
    is_affected_by_version: bool
    created_at: datetime
    user_friendly_message: str = "获取比对结果列表成功～"

    class Config:
        from_attributes = True


class CompareExecuteResponse(BaseModel):
    meeting_id: int
    total_compared: int
    matched_count: int
    mismatched_count: int
    need_review_count: int
    average_similarity: float
    user_friendly_message: str = "智能比对完成～"


class KeywordMatchResult(BaseModel):
    keyword: str
    found: bool
    position: Optional[int]
    user_friendly_message: str = "关键词匹配完成～"


class SentenceCompareResult(BaseModel):
    standard_sentence: str
    meeting_sentence: str
    similarity: float
    is_match: bool
    diff: Optional[str]
    user_friendly_message: str = "句子比对完成～"
