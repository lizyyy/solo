from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class LifecycleRule(Base):
    __tablename__ = "lifecycle_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="draft")
    prefix = Column(String(500), nullable=True)
    days_after_modification = Column(Integer, nullable=True)
    days_after_creation = Column(Integer, nullable=True)
    expiration_date = Column(DateTime, nullable=True)
    tag_filters = Column(JSON, default=list)
    action = Column(String(50), default="Delete")
    noncurrent_version_days = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    preview_reports = relationship("PreviewReport", back_populates="rule")


class StorageObject(Base):
    __tablename__ = "storage_objects"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(1000), index=True)
    bucket = Column(String(255), index=True)
    size = Column(Integer, default=0)
    last_modified = Column(DateTime, index=True)
    creation_date = Column(DateTime)
    etag = Column(String(100))
    version_id = Column(String(100), nullable=True)
    is_latest = Column(Boolean, default=True)
    tags = Column(JSON, default=dict)
    storage_class = Column(String(50), default="STANDARD")

    preview_hits = relationship("PreviewHit", back_populates="storage_object")


class PreviewReport(Base):
    __tablename__ = "preview_reports"

    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(Integer, ForeignKey("lifecycle_rules.id"))
    name = Column(String(255))
    status = Column(String(50), default="pending")
    total_objects = Column(Integer, default=0)
    hit_objects = Column(Integer, default=0)
    total_size = Column(Integer, default=0)
    hit_size = Column(Integer, default=0)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    requires_manual_review = Column(Boolean, default=False)
    review_reason = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    rule = relationship("LifecycleRule", back_populates="preview_reports")
    hits = relationship("PreviewHit", back_populates="report", cascade="all, delete-orphan")


class PreviewHit(Base):
    __tablename__ = "preview_hits"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("preview_reports.id"))
    object_id = Column(Integer, ForeignKey("storage_objects.id"))
    object_key = Column(String(1000))
    hit_reason = Column(String(500))
    action = Column(String(50))
    estimated_deletion_date = Column(DateTime)
    object_size = Column(Integer)
    last_modified = Column(DateTime)

    report = relationship("PreviewReport", back_populates="hits")
    storage_object = relationship("StorageObject", back_populates="preview_hits")
