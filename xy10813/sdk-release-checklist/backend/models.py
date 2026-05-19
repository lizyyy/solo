from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class ReleaseStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    DOCS_SYNCED = "docs_synced"
    EXAMPLES_VERIFIED = "examples_verified"
    COMPATIBILITY_CONFIRMED = "compatibility_confirmed"
    APPROVED = "approved"
    PUBLISHED = "published"
    ROLLED_BACK = "rolled_back"
    FAILED = "failed"


class SDKVersion(Base):
    __tablename__ = "sdk_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    version = Column(String(50), index=True, nullable=False)
    sdk_name = Column(String(100), index=True, nullable=False)
    language = Column(String(50))
    release_date = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String(50), default=ReleaseStatus.DRAFT)
    changelog = Column(Text)
    release_notes = Column(Text)
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    request_idempotency_key = Column(String(100), unique=True)
    is_dirty = Column(Boolean, default=False)
    dirty_reason = Column(Text)
    
    interface_diffs = relationship("InterfaceDiff", back_populates="sdk_version", cascade="all, delete-orphan")
    example_projects = relationship("ExampleProject", back_populates="sdk_version", cascade="all, delete-orphan")
    compatibility_matrix = relationship("CompatibilityMatrix", back_populates="sdk_version", cascade="all, delete-orphan")
    release_tasks = relationship("ReleaseTask", back_populates="sdk_version", cascade="all, delete-orphan")
    rollback_notes = relationship("RollbackNote", back_populates="sdk_version", cascade="all, delete-orphan")
    status_history = relationship("StatusHistory", back_populates="sdk_version", cascade="all, delete-orphan")


class InterfaceDiff(Base):
    __tablename__ = "interface_diffs"
    
    id = Column(Integer, primary_key=True, index=True)
    sdk_version_id = Column(Integer, ForeignKey("sdk_versions.id"))
    interface_name = Column(String(200), nullable=False)
    change_type = Column(String(50))
    previous_signature = Column(Text)
    new_signature = Column(Text)
    description = Column(Text)
    breaking_change = Column(Boolean, default=False)
    verified = Column(Boolean, default=False)
    verified_by = Column(String(100))
    verified_at = Column(DateTime(timezone=True))
    
    sdk_version = relationship("SDKVersion", back_populates="interface_diffs")


class ExampleProject(Base):
    __tablename__ = "example_projects"
    
    id = Column(Integer, primary_key=True, index=True)
    sdk_version_id = Column(Integer, ForeignKey("sdk_versions.id"))
    project_name = Column(String(200), nullable=False)
    project_url = Column(String(500))
    description = Column(Text)
    language = Column(String(50))
    build_status = Column(String(50), default="pending")
    test_status = Column(String(50), default="pending")
    verified = Column(Boolean, default=False)
    verified_by = Column(String(100))
    verified_at = Column(DateTime(timezone=True))
    verification_notes = Column(Text)
    
    sdk_version = relationship("SDKVersion", back_populates="example_projects")


class CompatibilityMatrix(Base):
    __tablename__ = "compatibility_matrix"
    
    id = Column(Integer, primary_key=True, index=True)
    sdk_version_id = Column(Integer, ForeignKey("sdk_versions.id"))
    platform = Column(String(100), nullable=False)
    min_version = Column(String(50))
    max_version = Column(String(50))
    supported = Column(Boolean, default=True)
    notes = Column(Text)
    confirmed = Column(Boolean, default=False)
    confirmed_by = Column(String(100))
    confirmed_at = Column(DateTime(timezone=True))
    
    sdk_version = relationship("SDKVersion", back_populates="compatibility_matrix")


class ReleaseTask(Base):
    __tablename__ = "release_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    sdk_version_id = Column(Integer, ForeignKey("sdk_versions.id"))
    task_name = Column(String(200), nullable=False)
    task_type = Column(String(50))
    description = Column(Text)
    assignee = Column(String(100))
    status = Column(String(50), default="pending")
    priority = Column(String(20), default="medium")
    due_date = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    completed_by = Column(String(100))
    dependency_task_ids = Column(JSON)
    notes = Column(Text)
    
    sdk_version = relationship("SDKVersion", back_populates="release_tasks")


class RollbackNote(Base):
    __tablename__ = "rollback_notes"
    
    id = Column(Integer, primary_key=True, index=True)
    sdk_version_id = Column(Integer, ForeignKey("sdk_versions.id"))
    reason = Column(Text, nullable=False)
    rollback_version = Column(String(50))
    affected_components = Column(JSON)
    rollback_date = Column(DateTime(timezone=True), server_default=func.now())
    rolled_back_by = Column(String(100))
    resolution_plan = Column(Text)
    
    sdk_version = relationship("SDKVersion", back_populates="rollback_notes")


class StatusHistory(Base):
    __tablename__ = "status_history"
    
    id = Column(Integer, primary_key=True, index=True)
    sdk_version_id = Column(Integer, ForeignKey("sdk_versions.id"))
    from_status = Column(String(50))
    to_status = Column(String(50), nullable=False)
    changed_by = Column(String(100))
    changed_at = Column(DateTime(timezone=True), server_default=func.now())
    reason = Column(Text)
    previous_data = Column(JSON)
    
    sdk_version = relationship("SDKVersion", back_populates="status_history")


class CompensationAction(Base):
    __tablename__ = "compensation_actions"
    
    id = Column(Integer, primary_key=True, index=True)
    sdk_version_id = Column(Integer, ForeignKey("sdk_versions.id"))
    action_type = Column(String(100), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="pending")
    executed_at = Column(DateTime(timezone=True))
    executed_by = Column(String(100))
    result = Column(Text)
    error_details = Column(Text)
