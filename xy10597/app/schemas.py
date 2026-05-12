from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class OrderStatus(str, Enum):
    CREATED = "CREATED"
    RECOMMEND_GENERATED = "RECOMMEND_GENERATED"
    IN_PROGRESS = "IN_PROGRESS"
    FEEDBACK_SUBMITTED = "FEEDBACK_SUBMITTED"
    COMPLETED = "COMPLETED"
    EXCEPTION = "EXCEPTION"


class CreateOrderRequest(BaseModel):
    order_no: str = Field(..., description="工单编号")
    model_code: str = Field(..., description="机型代码")
    error_code: str = Field(..., description="错误码")
    description: str = Field(..., description="故障描述")
    engineer_id: Optional[str] = Field(None, description="工程师ID")


class AdvanceOrderRequest(BaseModel):
    action: str = Field(..., description="操作类型: generate, execute, feedback, complete")
    operator: Optional[str] = Field(None, description="操作者")
    feedback_data: Optional[Dict[str, Any]] = Field(None, description="反馈数据")
    reason: Optional[str] = Field(None, description="操作原因")


class KnowledgeSnippet(BaseModel):
    knowledge_code: str
    title: str
    match_score: float
    model_match: bool
    is_expired: bool
    success_rate: float
    suggested_parts: List[str]


class SimilarHistory(BaseModel):
    order_no: str
    model_code: str
    error_code: str
    description: str
    solution: str
    resolved: bool
    similarity: float


class PartAvailability(BaseModel):
    part_code: str
    part_name: str
    available: bool
    stock_quantity: int
    safety_stock: int


class RecommendationResult(BaseModel):
    recommendation_id: int
    round_no: int
    status: str
    knowledge_recommendations: List[KnowledgeSnippet]
    similar_histories: List[SimilarHistory]
    part_availability: List[PartAvailability]
    created_at: datetime


class ManualCorrection(BaseModel):
    operator: str
    reason: str
    priority_knowledge_code: str
    comment: Optional[str] = None


class OrderStatusResponse(BaseModel):
    order_no: str
    status: str
    histories: List[Dict[str, Any]]
    current_recommendation: Optional[RecommendationResult]
