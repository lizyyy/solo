from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class ModelVersion(Base):
    __tablename__ = "model_versions"

    id = Column(Integer, primary_key=True, index=True)
    version_name = Column(String, unique=True, index=True)
    model_name = Column(String, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    evaluations = relationship("Evaluation", back_populates="model_version")
    release_suggestions = relationship("ReleaseSuggestion", back_populates="model_version")

class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, index=True)
    model_version_id = Column(Integer, ForeignKey("model_versions.id"))
    dataset_name = Column(String, index=True)
    dataset_version = Column(String)
    status = Column(String, index=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    total_samples = Column(Integer)
    passed_samples = Column(Integer)
    failed_samples = Column(Integer)
    error_message = Column(Text, nullable=True)

    model_version = relationship("ModelVersion", back_populates="evaluations")
    metrics = relationship("Metric", back_populates="evaluation", cascade="all, delete-orphan")
    failure_samples = relationship("FailureSample", back_populates="evaluation", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="evaluation", cascade="all, delete-orphan")

class Metric(Base):
    __tablename__ = "metrics"

    id = Column(Integer, primary_key=True, index=True)
    evaluation_id = Column(Integer, ForeignKey("evaluations.id"))
    metric_name = Column(String, index=True)
    metric_value = Column(Float)
    metric_unit = Column(String, nullable=True)
    threshold = Column(Float, nullable=True)
    is_alert = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    evaluation = relationship("Evaluation", back_populates="metrics")

class FailureSample(Base):
    __tablename__ = "failure_samples"

    id = Column(Integer, primary_key=True, index=True)
    evaluation_id = Column(Integer, ForeignKey("evaluations.id"))
    sample_id = Column(String, index=True)
    input_data = Column(Text)
    expected_output = Column(Text)
    actual_output = Column(Text)
    error_type = Column(String)
    is_resolved = Column(Boolean, default=False)
    resolution_note = Column(Text, nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    evaluation = relationship("Evaluation", back_populates="failure_samples")

class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    evaluation_id = Column(Integer, ForeignKey("evaluations.id"))
    author = Column(String)
    content = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    evaluation = relationship("Evaluation", back_populates="notes")

class ReleaseSuggestion(Base):
    __tablename__ = "release_suggestions"

    id = Column(Integer, primary_key=True, index=True)
    model_version_id = Column(Integer, ForeignKey("model_versions.id"))
    suggestion_type = Column(String)
    content = Column(Text)
    author = Column(String)
    is_approved = Column(Boolean, default=False)
    approved_by = Column(String, nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    model_version = relationship("ModelVersion", back_populates="release_suggestions")
