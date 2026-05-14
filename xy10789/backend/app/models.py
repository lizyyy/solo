from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class UserRole(str, enum.Enum):
    ANALYST = "analyst"
    PROCESSOR = "processor"
    ADMIN = "admin"


class ArticleStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    BLOCKED = "blocked"
    APPROVED = "approved"
    PUBLISHED = "published"
    ROLLBACKED = "rollbacked"


class FeedbackType(str, enum.Enum):
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True)
    role = Column(Enum(UserRole), default=UserRole.ANALYST)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ArticleVersion(Base):
    __tablename__ = "article_versions"

    id = Column(Integer, primary_key=True, index=True)
    article_id = Column(String(100), index=True)
    version = Column(String(20))
    title = Column(String(200))
    original_content = Column(Text)
    processed_content = Column(Text, nullable=True)
    status = Column(Enum(ArticleStatus), default=ArticleStatus.DRAFT)
    created_by = Column(Integer, ForeignKey("users.id"))
    processor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    block_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    published_at = Column(DateTime(timezone=True), nullable=True)

    creator = relationship("User", foreign_keys=[created_by], backref="created_articles")
    processor = relationship("User", foreign_keys=[processor_id], backref="processed_articles")
    feedbacks = relationship("Feedback", back_populates="article")


class Feedback(Base):
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    article_version_id = Column(Integer, ForeignKey("article_versions.id"))
    user_comment = Column(Text, nullable=True)
    feedback_type = Column(Enum(FeedbackType), default=FeedbackType.NEUTRAL)
    rating = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    article = relationship("ArticleVersion", back_populates="feedbacks")


class RevisionDraft(Base):
    __tablename__ = "revision_drafts"

    id = Column(Integer, primary_key=True, index=True)
    article_version_id = Column(Integer, ForeignKey("article_versions.id"))
    content = Column(Text)
    is_dirty = Column(Integer, default=0)
    block_reason = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
