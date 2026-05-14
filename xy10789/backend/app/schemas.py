from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from models import UserRole, ArticleStatus, FeedbackType


class UserBase(BaseModel):
    username: str
    role: UserRole


class UserCreate(UserBase):
    pass


class User(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ArticleVersionBase(BaseModel):
    article_id: str
    version: str
    title: str
    original_content: str


class ArticleVersionCreate(ArticleVersionBase):
    pass


class ArticleVersionUpdate(BaseModel):
    processed_content: Optional[str] = None
    status: Optional[ArticleStatus] = None
    block_reason: Optional[str] = None


class ArticleVersion(ArticleVersionBase):
    id: int
    processed_content: Optional[str] = None
    status: ArticleStatus
    created_by: int
    processor_id: Optional[int] = None
    block_reason: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    published_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FeedbackBase(BaseModel):
    article_version_id: int
    user_comment: Optional[str] = None
    feedback_type: FeedbackType = FeedbackType.NEUTRAL
    rating: Optional[int] = None


class FeedbackCreate(FeedbackBase):
    pass


class Feedback(FeedbackBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class RevisionDraftBase(BaseModel):
    article_version_id: int
    content: str


class RevisionDraftCreate(RevisionDraftBase):
    pass


class RevisionDraft(RevisionDraftBase):
    id: int
    is_dirty: int
    block_reason: Optional[str] = None
    created_by: int
    created_at: datetime

    class Config:
        from_attributes = True


class FeedbackTrendItem(BaseModel):
    date: str
    positive: int
    neutral: int
    negative: int


class FeedbackTrendResponse(BaseModel):
    article_id: str
    trends: List[FeedbackTrendItem]
