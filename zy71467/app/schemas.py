from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field

from .models import QuestionType, GradingStatus, RiskType


class GradingRequest(BaseModel):
    student_id: str = Field(..., description="学生ID")
    question_id: str = Field(..., description="题目ID")
    question_type: QuestionType = Field(..., description="题型")
    student_answer: Dict[str, Any] = Field(..., description="学生答案")
    standard_answer: Dict[str, Any] = Field(..., description="标准答案")
    full_score: float = Field(default=10.0, description="满分")


class PartialScoreItem(BaseModel):
    dimension: str = Field(..., description="得分维度")
    max_score: float = Field(..., description="该维度满分")
    actual_score: float = Field(..., description="该维度实际得分")
    explanation: str = Field(..., description="得分说明（业务易懂）")


class ErrorExplanation(BaseModel):
    error_type: str = Field(..., description="错误类型")
    position: Optional[str] = Field(None, description="错误位置")
    student_value: Any = Field(None, description="学生答案")
    standard_value: Any = Field(None, description="标准答案")
    explanation: str = Field(..., description="错因解释（业务易懂）")


class RiskFlag(BaseModel):
    risk_type: RiskType = Field(..., description="风险类型")
    severity: str = Field(..., description="风险级别：low/medium/high")
    description: str = Field(..., description="风险说明（业务易懂）")
    suggestion: str = Field(..., description="处理建议")


class GradingResponse(BaseModel):
    record_id: int = Field(..., description="答题记录ID")
    result_id: int = Field(..., description="判分结果ID")
    score: float = Field(..., description="总得分")
    full_score: float = Field(..., description="满分")
    is_correct: bool = Field(..., description="是否完全正确")
    status: GradingStatus = Field(..., description="判分状态")
    needs_manual_review: bool = Field(..., description="是否需要人工复核")
    review_reason: Optional[str] = Field(None, description="人工复核原因")
    partial_scores: List[PartialScoreItem] = Field(default_factory=list, description="分步得分")
    error_explanations: List[ErrorExplanation] = Field(default_factory=list, description="错因解释")
    risk_flags: List[RiskFlag] = Field(default_factory=list, description="风险标记")
    graded_at: datetime = Field(..., description="判分时间")


class AnswerRecordResponse(BaseModel):
    id: int
    student_id: str
    question_id: str
    question_type: QuestionType
    student_answer: Dict[str, Any]
    standard_answer: Dict[str, Any]
    full_score: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
