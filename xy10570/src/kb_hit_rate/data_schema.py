from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class KnowledgeArticleInput(BaseModel):
    article_id: str
    version: Optional[int] = 1
    title: str
    content: str
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    is_active: bool = True


class ConversationMessageInput(BaseModel):
    message_id: str
    sender_type: str
    sender_id: Optional[str] = None
    content: str
    timestamp: datetime


class ConversationInput(BaseModel):
    conversation_id: str
    user_id: Optional[str] = None
    agent_id: Optional[str] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
    channel: Optional[str] = None
    summary: Optional[str] = None
    messages: List[ConversationMessageInput] = []


class BotRecommendationInput(BaseModel):
    recommendation_id: str
    conversation_id: str
    message_id: Optional[str] = None
    article_id: str
    article_version: Optional[int] = None
    rank: int
    score: Optional[float] = None
    recommended_at: datetime


class AgentCitationInput(BaseModel):
    citation_id: str
    conversation_id: str
    message_id: str
    article_id: str
    article_version: Optional[int] = None
    cited_text: Optional[str] = None
    is_copy: bool = False
    is_rewritten: bool = False
    cited_at: datetime


class UserFeedbackInput(BaseModel):
    feedback_id: str
    conversation_id: str
    message_id: Optional[str] = None
    article_id: Optional[str] = None
    rating: Optional[int] = None
    comment: Optional[str] = None
    is_helpful: Optional[bool] = None
    resolved: Optional[bool] = None
    feedback_at: datetime


class ImportBatch(BaseModel):
    articles: List[KnowledgeArticleInput] = []
    conversations: List[ConversationInput] = []
    recommendations: List[BotRecommendationInput] = []
    citations: List[AgentCitationInput] = []
    feedbacks: List[UserFeedbackInput] = []


class ImportResult(BaseModel):
    total: int = 0
    success: int = 0
    skipped: int = 0
    failed: int = 0
    errors: List[str] = []
