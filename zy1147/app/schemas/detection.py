from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class DetectionRequest(BaseModel):
    text: str = Field(..., min_length=1, description="待检测文本")
    context: Optional[Dict[str, Any]] = Field(None, description="上下文信息")
    options: Optional[Dict[str, Any]] = Field(
        None, 
        description="检测选项: include_semantic(bool), include_variants(bool), strict_mode(bool)"
    )


class BatchDetectionRequest(BaseModel):
    texts: List[str] = Field(..., min_length=1, description="待检测文本列表")
    context: Optional[Dict[str, Any]] = None
    options: Optional[Dict[str, Any]] = None


class DetectionHitResponse(BaseModel):
    hit_word: str = Field(description="命中的词")
    matched_word: str = Field(description="匹配的原始敏感词")
    start_position: int = Field(description="起始位置")
    end_position: int = Field(description="结束位置")
    match_type: str = Field(description="匹配类型: exact/regex/synonym/pinyin/semantic")
    category: str = Field(description="分类")
    severity: str = Field(description="严重级别")
    description: str = Field(description="原因解释")
    suggestion: str = Field(description="建议处理动作")
    context_before: Optional[str] = Field(None, description="上下文前")
    context_after: Optional[str] = Field(None, description="上下文后")
    confidence: float = Field(description="置信度")
    sensitive_word_id: Optional[int] = Field(None, description="敏感词ID")
    is_false_positive: bool = Field(default=False, description="是否误报")
    false_positive_reason: Optional[str] = Field(None, description="误报原因")


class SegmentResponse(BaseModel):
    word: str
    start: int
    end: int
    length: int


class DetectionResponse(BaseModel):
    request_id: str = Field(description="请求ID")
    original_text: str = Field(description="原始文本")
    normalized_text: str = Field(description="归一化文本")
    segments: List[SegmentResponse] = Field(description="分词结果")
    is_sensitive: bool = Field(description="是否敏感")
    highest_severity: str = Field(description="最高严重级别")
    total_hits: int = Field(description="命中数量")
    hits: List[DetectionHitResponse] = Field(description="命中详情")
    processing_time_ms: int = Field(description="处理耗时(ms)")
    lexicon_version: str = Field(description="词库版本")


class BatchDetectionResponse(BaseModel):
    results: List[DetectionResponse] = Field(description="检测结果列表")
    total_count: int = Field(description="总数量")
    sensitive_count: int = Field(description="敏感数量")
    processing_time_ms: int = Field(description="总耗时(ms)")


class DetectionHistoryResponse(BaseModel):
    id: int
    request_id: str
    original_text: str
    normalized_text: Optional[str]
    is_sensitive: bool
    highest_severity: Optional[str]
    total_hits: int
    processing_time_ms: Optional[int]
    client_ip: Optional[str]
    review_status: str
    reviewed_by: Optional[str]
    reviewed_at: Optional[datetime]
    lexicon_version: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class DetectionHistoryDetailResponse(DetectionHistoryResponse):
    segments: List[SegmentResponse] = []
    hits: List[DetectionHitResponse] = []
