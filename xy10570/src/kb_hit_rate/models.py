from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    Boolean,
    Float,
    JSON,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import relationship, DeclarativeBase


class Base(DeclarativeBase):
    pass


class KnowledgeArticle(Base):
    __tablename__ = "knowledge_articles"

    id = Column(Integer, primary_key=True)
    article_id = Column(String(64), nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)
    title = Column(String(256), nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(128), nullable=True)
    tags = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    __table_args__ = (
        UniqueConstraint("article_id", "version", name="uq_article_version"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "article_id": self.article_id,
            "version": self.version,
            "title": self.title,
            "category": self.category,
            "tags": self.tags,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True)
    conversation_id = Column(String(64), nullable=False, unique=True, index=True)
    user_id = Column(String(64), nullable=True)
    agent_id = Column(String(64), nullable=True)
    started_at = Column(DateTime, nullable=False)
    ended_at = Column(DateTime, nullable=True)
    channel = Column(String(32), nullable=True)
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "conversation_id": self.conversation_id,
            "user_id": self.user_id,
            "agent_id": self.agent_id,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "channel": self.channel,
        }


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id = Column(Integer, primary_key=True)
    conversation_id = Column(String(64), ForeignKey("conversations.conversation_id"), nullable=False, index=True)
    message_id = Column(String(64), nullable=False, unique=True)
    sender_type = Column(String(16), nullable=False)
    sender_id = Column(String(64), nullable=True)
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_conv_msg_timestamp", "conversation_id", "timestamp"),
    )


class BotRecommendation(Base):
    __tablename__ = "bot_recommendations"

    id = Column(Integer, primary_key=True)
    recommendation_id = Column(String(64), nullable=False, unique=True)
    conversation_id = Column(String(64), nullable=False, index=True)
    message_id = Column(String(64), nullable=True)
    article_id = Column(String(64), nullable=False, index=True)
    article_version = Column(Integer, nullable=True)
    rank = Column(Integer, nullable=False)
    score = Column(Float, nullable=True)
    recommended_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class AgentCitation(Base):
    __tablename__ = "agent_citations"

    id = Column(Integer, primary_key=True)
    citation_id = Column(String(64), nullable=False, unique=True)
    conversation_id = Column(String(64), nullable=False, index=True)
    message_id = Column(String(64), nullable=False)
    article_id = Column(String(64), nullable=False, index=True)
    article_version = Column(Integer, nullable=True)
    cited_text = Column(Text, nullable=True)
    is_copy = Column(Boolean, default=False)
    is_rewritten = Column(Boolean, default=False)
    cited_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserFeedback(Base):
    __tablename__ = "user_feedback"

    id = Column(Integer, primary_key=True)
    feedback_id = Column(String(64), nullable=False, unique=True)
    conversation_id = Column(String(64), nullable=False, index=True)
    message_id = Column(String(64), nullable=True)
    article_id = Column(String(64), nullable=True, index=True)
    rating = Column(Integer, nullable=True)
    comment = Column(Text, nullable=True)
    is_helpful = Column(Boolean, nullable=True)
    resolved = Column(Boolean, nullable=True)
    feedback_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class HitEvent(Base):
    __tablename__ = "hit_events"

    id = Column(Integer, primary_key=True)
    event_id = Column(String(64), nullable=False, unique=True)
    conversation_id = Column(String(64), nullable=False, index=True)
    article_id = Column(String(64), nullable=False, index=True)
    article_version = Column(Integer, nullable=False)
    hit_type = Column(String(32), nullable=False)
    source = Column(String(32), nullable=False)
    rating = Column(Integer, nullable=True)
    is_helpful = Column(Boolean, nullable=True)
    resolved = Column(Boolean, nullable=True)
    occurred_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_hit_article", "article_id", "article_version"),
        Index("ix_hit_conv_article", "conversation_id", "article_id"),
    )


class ImportRecord(Base):
    __tablename__ = "import_records"

    id = Column(Integer, primary_key=True)
    import_id = Column(String(64), nullable=False, unique=True)
    source_type = Column(String(32), nullable=False)
    source_file = Column(String(256), nullable=True)
    status = Column(String(32), nullable=False)
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    skipped_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    operator = Column(String(64), nullable=True)

    __table_args__ = (
        Index("ix_import_source", "source_type", "started_at"),
    )


class ManualCorrection(Base):
    __tablename__ = "manual_corrections"

    id = Column(Integer, primary_key=True)
    correction_id = Column(String(64), nullable=False, unique=True)
    target_type = Column(String(32), nullable=False)
    target_id = Column(String(64), nullable=False)
    before_value = Column(JSON, nullable=True)
    after_value = Column(JSON, nullable=True)
    reason = Column(Text, nullable=True)
    operator = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class SystemLog(Base):
    __tablename__ = "system_logs"

    id = Column(Integer, primary_key=True)
    log_id = Column(String(64), nullable=False, unique=True)
    level = Column(String(16), nullable=False)
    message = Column(Text, nullable=False)
    context = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    operator = Column(String(64), nullable=True)

    __table_args__ = (
        Index("ix_log_created", "created_at"),
    )
