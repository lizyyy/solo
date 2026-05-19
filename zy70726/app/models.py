from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()


class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cache_entries = relationship("CacheEntry", back_populates="project")


class CacheEntry(Base):
    __tablename__ = "cache_entries"

    id = Column(String, primary_key=True, index=True)
    cache_key = Column(String, index=True, nullable=False)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    hit_count = Column(Integer, default=0)
    last_accessed_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_protected = Column(Boolean, default=False)

    project = relationship("Project", back_populates="cache_entries")
    eviction_requests = relationship("EvictionRequest", back_populates="cache_entry", passive_deletes=True)


class EvictionRequest(Base):
    __tablename__ = "eviction_requests"

    id = Column(String, primary_key=True, index=True)
    cache_entry_id = Column(String, ForeignKey("cache_entries.id"), nullable=False)
    status = Column(String, index=True, nullable=False)
    requester = Column(String)
    reason = Column(Text)
    impact_score = Column(Float)
    impact_analysis = Column(Text)
    requires_manual_review = Column(Boolean, default=False)
    review_comment = Column(Text)
    reviewed_by = Column(String)
    reviewed_at = Column(DateTime)
    executed_at = Column(DateTime)
    cache_size_bytes = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cache_entry = relationship("CacheEntry", back_populates="eviction_requests")


class EvictionReport(Base):
    __tablename__ = "eviction_reports"

    id = Column(String, primary_key=True, index=True)
    total_evicted = Column(Integer, default=0)
    total_space_freed_bytes = Column(Integer, default=0)
    total_impact_score = Column(Float, default=0)
    report_data = Column(Text)
    generated_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
