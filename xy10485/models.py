from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base
import enum

class VersionStatus(enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    EXPIRED = "expired"

class KnowledgeEntry(Base):
    __tablename__ = "knowledge_entries"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    versions = relationship("KnowledgeVersion", back_populates="entry", cascade="all, delete-orphan")
    
    @property
    def current_published_version(self):
        for version in sorted(self.versions, key=lambda v: v.version_number, reverse=True):
            if version.status == VersionStatus.PUBLISHED:
                return version
        return None

class KnowledgeVersion(Base):
    __tablename__ = "knowledge_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    entry_id = Column(Integer, ForeignKey("knowledge_entries.id"), nullable=False)
    version_number = Column(Integer, default=1)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    keywords = Column(Text)
    status = Column(Enum(VersionStatus), default=VersionStatus.DRAFT)
    created_at = Column(DateTime, default=datetime.utcnow)
    published_at = Column(DateTime, nullable=True)
    expired_at = Column(DateTime, nullable=True)
    expiry_reason = Column(Text, nullable=True)
    
    entry = relationship("KnowledgeEntry", back_populates="versions")
    matches = relationship("QueryMatch", back_populates="version")

class QueryMatch(Base):
    __tablename__ = "query_matches"
    
    id = Column(Integer, primary_key=True, index=True)
    query_text = Column(Text, nullable=False)
    query_id = Column(String(100), index=True)
    version_id = Column(Integer, ForeignKey("knowledge_versions.id"), nullable=False)
    match_score = Column(Integer, default=0)
    is_adopted = Column(Boolean, default=False)
    is_rewritten = Column(Boolean, default=False)
    rewritten_answer = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    version = relationship("KnowledgeVersion", back_populates="matches")

class QueryFeedback(Base):
    __tablename__ = "query_feedbacks"
    
    id = Column(Integer, primary_key=True, index=True)
    query_text = Column(Text, nullable=False)
    query_id = Column(String(100), index=True)
    is_no_answer = Column(Boolean, default=False)
    feedback_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
