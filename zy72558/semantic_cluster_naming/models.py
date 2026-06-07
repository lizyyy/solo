from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, Boolean,
    DateTime, Text, ForeignKey, JSON, UniqueConstraint, Index
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker

Base = declarative_base()


class SnapshotStatus(str, Enum):
    IMPORTED = "imported"
    DUPLICATE_DETECTED = "duplicate_detected"
    SUPPLEMENTED = "supplemented"
    RECALCULATING = "recalculating"


class TrainingStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    DUPLICATE_TRAINING = "duplicate_training"


class ReviewStatus(str, Enum):
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    NORMAL = "normal"


class FeatureSnapshot(Base):
    __tablename__ = "feature_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    snapshot_id = Column(String(64), nullable=False, index=True)
    original_row_number = Column(Integer, nullable=False)
    raw_data = Column(JSON, nullable=False)
    vector_data = Column(JSON, nullable=True)
    content_hash = Column(String(64), nullable=False, index=True)
    status = Column(String(32), nullable=False, default=SnapshotStatus.IMPORTED.value)
    imported_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    imported_by = Column(String(64), nullable=False, default="system")
    source_file = Column(String(255), nullable=True)
    is_duplicate = Column(Boolean, nullable=False, default=False)
    duplicate_of_snapshot_id = Column(String(64), nullable=True)
    supplement_version = Column(Integer, nullable=False, default=1)
    remarks = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("snapshot_id", "original_row_number", "supplement_version",
                         name="uq_snapshot_row_version"),
        Index("idx_snapshot_status", "snapshot_id", "status"),
    )

    clustering_runs = relationship("ClusteringRun", back_populates="snapshot")
    audit_logs = relationship("AuditLog", back_populates="snapshot")


class ClusteringRun(Base):
    __tablename__ = "clustering_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(64), nullable=False, unique=True, index=True)
    snapshot_id = Column(String(64), nullable=False, index=True)
    snapshot_db_id = Column(Integer, ForeignKey("feature_snapshots.id"), nullable=False)
    algorithm = Column(String(64), nullable=False, default="kmeans")
    params = Column(JSON, nullable=False, default=dict)
    status = Column(String(32), nullable=False, default=TrainingStatus.PENDING.value)
    review_status = Column(String(32), nullable=False, default=ReviewStatus.NORMAL.value)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    training_log = Column(Text, nullable=True)
    metrics = Column(JSON, nullable=True)
    is_duplicate_run = Column(Boolean, nullable=False, default=False)
    duplicate_of_run_id = Column(String(64), nullable=True)
    data_hash = Column(String(64), nullable=False, index=True)
    created_by = Column(String(64), nullable=False, default="system")
    remarks = Column(Text, nullable=True)

    snapshot = relationship("FeatureSnapshot", back_populates="clustering_runs")
    results = relationship("ClusteringResult", back_populates="run", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="run")


class ClusteringResult(Base):
    __tablename__ = "clustering_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(64), ForeignKey("clustering_runs.run_id"), nullable=False, index=True)
    snapshot_id = Column(String(64), nullable=False, index=True)
    original_row_number = Column(Integer, nullable=False)
    cluster_id = Column(Integer, nullable=False)
    cluster_name = Column(String(255), nullable=True)
    cluster_name_edited = Column(Boolean, nullable=False, default=False)
    cluster_name_edited_by = Column(String(64), nullable=True)
    cluster_name_edited_at = Column(DateTime, nullable=True)
    confidence = Column(Float, nullable=True)
    position_in_cluster = Column(Integer, nullable=True)
    is_manual_override = Column(Boolean, nullable=False, default=False)
    override_reason = Column(Text, nullable=True)
    overridden_by = Column(String(64), nullable=True)
    overridden_at = Column(DateTime, nullable=True)
    raw_vector = Column(JSON, nullable=True)
    result_hash = Column(String(64), nullable=False)

    __table_args__ = (
        UniqueConstraint("run_id", "snapshot_id", "original_row_number",
                         name="uq_run_snapshot_row"),
        Index("idx_cluster", "run_id", "cluster_id"),
    )

    run = relationship("ClusteringRun", back_populates="results")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow)
    action = Column(String(64), nullable=False)
    actor = Column(String(64), nullable=False, default="system")
    snapshot_id = Column(String(64), nullable=True, index=True)
    snapshot_db_id = Column(Integer, ForeignKey("feature_snapshots.id"), nullable=True)
    run_id = Column(String(64), nullable=True, index=True)
    run_db_id = Column(Integer, ForeignKey("clustering_runs.id"), nullable=True)
    field_changed = Column(String(64), nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    details = Column(JSON, nullable=True)
    ip_address = Column(String(64), nullable=True)

    snapshot = relationship("FeatureSnapshot", back_populates="audit_logs")
    run = relationship("ClusteringRun", back_populates="audit_logs")


class FeatureVersion(Base):
    __tablename__ = "feature_versions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version_id = Column(String(64), nullable=False, unique=True, index=True)
    snapshot_id = Column(String(64), nullable=False, index=True)
    run_id = Column(String(64), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    is_active = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_by = Column(String(64), nullable=False, default="system")
    approved_by = Column(String(64), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    change_log = Column(Text, nullable=True)
    metrics_summary = Column(JSON, nullable=True)

    __table_args__ = (
        UniqueConstraint("snapshot_id", "version_number", name="uq_snapshot_version"),
    )


class ExportRecord(Base):
    __tablename__ = "export_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    export_id = Column(String(64), nullable=False, unique=True, index=True)
    run_id = Column(String(64), nullable=False, index=True)
    snapshot_id = Column(String(64), nullable=False, index=True)
    export_format = Column(String(32), nullable=False, default="csv")
    exported_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    exported_by = Column(String(64), nullable=False, default="system")
    row_count = Column(Integer, nullable=False)
    content_hash = Column(String(64), nullable=False)
    file_path = Column(String(255), nullable=True)
    consistency_verified = Column(Boolean, nullable=False, default=False)


def init_db(db_url: str = "sqlite:///semantic_cluster.db"):
    engine = create_engine(db_url, echo=False)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    return Session, engine
