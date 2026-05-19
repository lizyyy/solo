import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from app.database import Base


class ChecklistStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    REVIEWING = "reviewing"
    APPROVED = "approved"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"
    CLOSED = "closed"


class MissingLevel(str, enum.Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ReleaseChecklist(Base):
    __tablename__ = "release_checklists"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String, index=True, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    status = Column(Enum(ChecklistStatus), default=ChecklistStatus.DRAFT)
    owner = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    raw_input = Column(Text)

    artifacts = relationship("Artifact", back_populates="checklist", cascade="all, delete-orphan")
    migration_scripts = relationship("MigrationScript", back_populates="checklist", cascade="all, delete-orphan")
    rollback_steps = relationship("RollbackStep", back_populates="checklist", cascade="all, delete-orphan")
    reports = relationship("CheckReport", back_populates="checklist", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="checklist", cascade="all, delete-orphan")


class Artifact(Base):
    __tablename__ = "artifacts"

    id = Column(Integer, primary_key=True, index=True)
    checklist_id = Column(Integer, ForeignKey("release_checklists.id"), nullable=False)
    name = Column(String, nullable=False)
    path = Column(String, nullable=False)
    version = Column(String)
    exists = Column(Boolean, default=None)
    checked_at = Column(DateTime)
    checked_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    checklist = relationship("ReleaseChecklist", back_populates="artifacts")


class MigrationScript(Base):
    __tablename__ = "migration_scripts"

    id = Column(Integer, primary_key=True, index=True)
    checklist_id = Column(Integer, ForeignKey("release_checklists.id"), nullable=False)
    name = Column(String, nullable=False)
    path = Column(String, nullable=False)
    description = Column(Text)
    rollback_available = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    checklist = relationship("ReleaseChecklist", back_populates="migration_scripts")


class RollbackStep(Base):
    __tablename__ = "rollback_steps"

    id = Column(Integer, primary_key=True, index=True)
    checklist_id = Column(Integer, ForeignKey("release_checklists.id"), nullable=False)
    step_order = Column(Integer, nullable=False)
    description = Column(Text, nullable=False)
    owner = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    checklist = relationship("ReleaseChecklist", back_populates="rollback_steps")
