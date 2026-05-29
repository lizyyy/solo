from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship

from .database import Base


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="created")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    materials = relationship("Material", back_populates="batch", cascade="all, delete-orphan")
    parsed_logs = relationship("ParsedLogEntry", back_populates="batch", cascade="all, delete-orphan")
    cache_fingerprints = relationship("CacheFingerprint", back_populates="batch", cascade="all, delete-orphan")
    failure_clusters = relationship("FailureCluster", back_populates="batch", cascade="all, delete-orphan")
    reproduction_scripts = relationship("ReproductionScript", back_populates="batch", cascade="all, delete-orphan")
    anomalies = relationship("Anomaly", back_populates="batch", cascade="all, delete-orphan")
    reports = relationship("AnalysisReport", back_populates="batch", cascade="all, delete-orphan")


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    material_type = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    source = Column(String, nullable=False)
    file_path = Column(String, nullable=True)
    content_hash = Column(String, index=True)
    meta = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="materials")


class ParsedLogEntry(Base):
    __tablename__ = "parsed_log_entries"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=True)
    log_time = Column(DateTime, index=True)
    log_level = Column(String, index=True)
    category = Column(String, index=True)
    message = Column(Text, nullable=False)
    raw_text = Column(Text, nullable=False)
    line_number = Column(Integer)
    meta = Column(JSON, default={})
    is_anomaly = Column(Boolean, default=False)

    batch = relationship("Batch", back_populates="parsed_logs")
    material = relationship("Material")


class CacheFingerprint(Base):
    __tablename__ = "cache_fingerprints"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=True)
    cache_key = Column(String, index=True, nullable=False)
    fingerprint = Column(String, index=True, nullable=False)
    expected_fingerprint = Column(String, nullable=True)
    status = Column(String, default="unknown")
    dependency_name = Column(String)
    dependency_version = Column(String)
    meta = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="cache_fingerprints")
    material = relationship("Material")


class FailureCluster(Base):
    __tablename__ = "failure_clusters"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    cluster_type = Column(String, index=True, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    severity = Column(String, default="medium")
    affected_count = Column(Integer, default=0)
    sample_log_ids = Column(JSON, default=[])
    related_material_ids = Column(JSON, default=[])
    pattern_signature = Column(String, index=True)
    is_normal_result = Column(Boolean, default=False)
    meta = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="failure_clusters")


class ReproductionScript(Base):
    __tablename__ = "reproduction_scripts"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    cluster_id = Column(Integer, ForeignKey("failure_clusters.id"), nullable=True)
    name = Column(String, nullable=False)
    script_type = Column(String, default="bash")
    content = Column(Text, nullable=False)
    description = Column(Text)
    meta = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="reproduction_scripts")
    cluster = relationship("FailureCluster")


class Anomaly(Base):
    __tablename__ = "anomalies"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    anomaly_type = Column(String, index=True, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    severity = Column(String, default="medium")
    evidence_material_ids = Column(JSON, default=[])
    evidence_log_ids = Column(JSON, default=[])
    evidence_fingerprint_ids = Column(JSON, default=[])
    status = Column(String, default="identified")
    meta = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="anomalies")


class AnalysisReport(Base):
    __tablename__ = "analysis_reports"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    report_no = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False)
    summary = Column(Text)
    content = Column(Text, nullable=False)
    anomaly_count = Column(Integer, default=0)
    anomaly_details = Column(JSON, default={})
    reviewed_by = Column(String, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_comment = Column(Text, nullable=True)
    export_path = Column(String, nullable=True)
    status = Column(String, default="draft")
    meta = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    batch = relationship("Batch", back_populates="reports")
