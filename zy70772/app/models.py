import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Enum, Float
from sqlalchemy.orm import relationship
from app.database import Base


class FlagStatus(str, enum.Enum):
    PENDING = "pending"
    SCANNING = "scanning"
    ANALYZING = "analyzing"
    REVIEWING = "reviewing"
    APPROVED = "approved"
    DELETING = "deleting"
    COMPLETED = "completed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class RiskLevel(str, enum.Enum):
    SAFE = "safe"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ExperimentStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    UNKNOWN = "unknown"


class DeletionSuggestion(str, enum.Enum):
    SAFE_TO_DELETE = "safe_to_delete"
    NEEDS_REVIEW = "needs_review"
    DO_NOT_DELETE = "do_not_delete"


class FeatureFlag(Base):
    __tablename__ = "feature_flags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    default_value = Column(Boolean, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    status = Column(Enum(FlagStatus), default=FlagStatus.PENDING)
    risk_level = Column(Enum(RiskLevel), nullable=True)
    experiment_status = Column(Enum(ExperimentStatus), default=ExperimentStatus.UNKNOWN)
    deletion_suggestion = Column(Enum(DeletionSuggestion), nullable=True)
    owner = Column(String, nullable=True)
    notes = Column(Text, nullable=True)

    code_references = relationship("CodeReference", back_populates="feature_flag", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="feature_flag", cascade="all, delete-orphan")


class CodeReference(Base):
    __tablename__ = "code_references"

    id = Column(Integer, primary_key=True, index=True)
    feature_flag_id = Column(Integer, ForeignKey("feature_flags.id"), nullable=False)
    file_path = Column(String, nullable=False)
    line_number = Column(Integer, nullable=False)
    code_snippet = Column(Text, nullable=True)
    language = Column(String, nullable=True)
    repository = Column(String, nullable=True)
    found_at = Column(DateTime, default=datetime.utcnow)

    feature_flag = relationship("FeatureFlag", back_populates="code_references")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    feature_flag_id = Column(Integer, ForeignKey("feature_flags.id"), nullable=False)
    action = Column(String, nullable=False)
    old_status = Column(Enum(FlagStatus), nullable=True)
    new_status = Column(Enum(FlagStatus), nullable=True)
    processed_by = Column(String, nullable=False)
    conclusion = Column(Text, nullable=True)
    original_input = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    feature_flag = relationship("FeatureFlag", back_populates="audit_logs")


class CleanupReport(Base):
    __tablename__ = "cleanup_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_date = Column(DateTime, default=datetime.utcnow)
    total_flags = Column(Integer, default=0)
    safe_to_delete = Column(Integer, default=0)
    needs_review = Column(Integer, default=0)
    do_not_delete = Column(Integer, default=0)
    high_risk = Column(Integer, default=0)
    generated_by = Column(String, nullable=True)
    file_path = Column(String, nullable=True)
