import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Enum, Boolean
from sqlalchemy.orm import relationship

from app.database import Base


class BuildStatus(str, enum.Enum):
    PENDING = "pending"
    SCANNING = "scanning"
    ANALYZING = "analyzing"
    COMPLETED = "completed"
    FAILED = "failed"
    NEEDS_REVIEW = "needs_review"
    PROCESSED = "processed"


class ViolationType(str, enum.Enum):
    SIZE_EXCEEDED = "size_exceeded"
    NEW_LARGE_CHUNK = "new_large_chunk"
    UNEXPECTED_GROWTH = "unexpected_growth"
    DUPLICATE_MODULES = "duplicate_modules"
    BUDGET_NOT_SET = "budget_not_set"


class BuildArtifact(Base):
    __tablename__ = "build_artifacts"

    id = Column(Integer, primary_key=True, index=True)
    build_id = Column(String, index=True)
    project_name = Column(String, index=True)
    branch = Column(String, index=True)
    commit_hash = Column(String)
    built_at = Column(DateTime, default=datetime.utcnow)
    status = Column(Enum(BuildStatus), default=BuildStatus.PENDING)
    total_size = Column(Float, default=0)
    chunk_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    chunks = relationship("Chunk", back_populates="artifact", cascade="all, delete-orphan")
    reports = relationship("BudgetReport", back_populates="artifact", cascade="all, delete-orphan")


class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(Integer, primary_key=True, index=True)
    artifact_id = Column(Integer, ForeignKey("build_artifacts.id"))
    chunk_name = Column(String, index=True)
    file_size = Column(Float)
    gzip_size = Column(Float)
    budget_size = Column(Float)
    is_initial = Column(Boolean, default=False)
    is_async = Column(Boolean, default=False)

    artifact = relationship("BuildArtifact", back_populates="chunks")
    modules = relationship("ChunkModule", back_populates="chunk", cascade="all, delete-orphan")
    violations = relationship("Violation", back_populates="chunk", cascade="all, delete-orphan")


class ChunkModule(Base):
    __tablename__ = "chunk_modules"

    id = Column(Integer, primary_key=True, index=True)
    chunk_id = Column(Integer, ForeignKey("chunks.id"))
    module_path = Column(String, index=True)
    module_size = Column(Float)
    package_name = Column(String, index=True)
    is_third_party = Column(Boolean, default=False)

    chunk = relationship("Chunk", back_populates="modules")


class BudgetRule(Base):
    __tablename__ = "budget_rules"

    id = Column(Integer, primary_key=True, index=True)
    project_name = Column(String, index=True)
    chunk_pattern = Column(String)
    budget_size_kb = Column(Float)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    priority = Column(Integer, default=0)


class Violation(Base):
    __tablename__ = "violations"

    id = Column(Integer, primary_key=True, index=True)
    chunk_id = Column(Integer, ForeignKey("chunks.id"))
    report_id = Column(Integer, ForeignKey("budget_reports.id"))
    violation_type = Column(Enum(ViolationType))
    actual_size = Column(Float)
    budget_size = Column(Float)
    excess_size = Column(Float)
    growth_rate = Column(Float)
    reason = Column(Text)
    needs_review = Column(Boolean, default=False)
    reviewed = Column(Boolean, default=False)
    reviewed_at = Column(DateTime)
    reviewed_by = Column(String)

    chunk = relationship("Chunk", back_populates="violations")
    report = relationship("BudgetReport", back_populates="violations")


class BudgetReport(Base):
    __tablename__ = "budget_reports"

    id = Column(Integer, primary_key=True, index=True)
    artifact_id = Column(Integer, ForeignKey("build_artifacts.id"))
    report_hash = Column(String, index=True, unique=True)
    total_violations = Column(Integer, default=0)
    critical_violations = Column(Integer, default=0)
    warning_violations = Column(Integer, default=0)
    total_excess_kb = Column(Float, default=0)
    generated_at = Column(DateTime, default=datetime.utcnow)
    is_processed = Column(Boolean, default=False)
    processed_at = Column(DateTime)
    notes = Column(Text)

    artifact = relationship("BuildArtifact", back_populates="reports")
    violations = relationship("Violation", back_populates="report", cascade="all, delete-orphan")
