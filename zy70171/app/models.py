from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class DocumentVersion(Base):
    __tablename__ = "document_versions"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(String(100), index=True, nullable=False)
    version = Column(Integer, nullable=False)
    content_hash = Column(String(64), nullable=False)
    title = Column(String(500), nullable=True)
    content = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)

    __mapper_args__ = {
        "version_id_col": version
    }

    shard_validations = relationship("ShardValidation", back_populates="document_version")


class IndexTask(Base):
    __tablename__ = "index_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(100), unique=True, index=True, nullable=False)
    status = Column(String(20), default="pending", nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    failed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    rollback_status = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    target_document_count = Column(Integer, nullable=False)
    processed_document_count = Column(Integer, default=0)
    success_document_count = Column(Integer, default=0)
    failed_document_count = Column(Integer, default=0)

    shard_validations = relationship("ShardValidation", back_populates="index_task")
    recall_samples = relationship("RecallSample", back_populates="index_task")
    reports = relationship("RebuildReport", back_populates="index_task")


class ShardValidation(Base):
    __tablename__ = "shard_validations"

    id = Column(Integer, primary_key=True, index=True)
    shard_id = Column(String(100), index=True, nullable=False)
    document_version_id = Column(Integer, ForeignKey("document_versions.id"), nullable=False)
    index_task_id = Column(Integer, ForeignKey("index_tasks.id"), nullable=False)
    expected_hash = Column(String(64), nullable=False)
    actual_hash = Column(String(64), nullable=True)
    is_valid = Column(Boolean, nullable=True)
    validated_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    document_version = relationship("DocumentVersion", back_populates="shard_validations")
    index_task = relationship("IndexTask", back_populates="shard_validations")


class RecallSample(Base):
    __tablename__ = "recall_samples"

    id = Column(Integer, primary_key=True, index=True)
    index_task_id = Column(Integer, ForeignKey("index_tasks.id"), nullable=False)
    query = Column(Text, nullable=False)
    expected_document_id = Column(String(100), nullable=False)
    expected_version = Column(Integer, nullable=False)
    actual_document_id = Column(String(100), nullable=True)
    actual_version = Column(Integer, nullable=True)
    score = Column(Float, nullable=True)
    is_match = Column(Boolean, nullable=True)
    sampled_at = Column(DateTime(timezone=True), server_default=func.now())

    index_task = relationship("IndexTask", back_populates="recall_samples")


class RebuildReport(Base):
    __tablename__ = "rebuild_reports"

    id = Column(Integer, primary_key=True, index=True)
    index_task_id = Column(Integer, ForeignKey("index_tasks.id"), nullable=False)
    overall_status = Column(String(20), nullable=False)
    total_documents = Column(Integer, nullable=False)
    validated_documents = Column(Integer, nullable=False)
    valid_documents = Column(Integer, nullable=False)
    invalid_documents = Column(Integer, nullable=False)
    recall_samples_count = Column(Integer, nullable=False)
    recall_match_count = Column(Integer, nullable=False)
    recall_accuracy = Column(Float, nullable=False)
    summary = Column(Text, nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    index_task = relationship("IndexTask", back_populates="reports")
