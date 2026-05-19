import enum
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class BatchStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVING = "approving"
    APPROVED = "approved"
    PROCESSING = "processing"
    COMPLETED = "completed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    ROLLBACKED = "rollbacked"


class GapType(str, enum.Enum):
    MISSING = "missing"
    CORRUPTED = "corrupted"
    ANOMALY = "anomaly"


class SourceType(str, enum.Enum):
    LOG_REPLAY = "log_replay"
    HISTORY_RESTORE = "history_restore"
    MANUAL_FIX = "manual_fix"
    ALGORITHM_PREDICT = "algorithm_predict"


class OverrideStrategy(str, enum.Enum):
    PROTECT = "protect"
    MERGE = "merge"
    FORCE = "force"


class GrayBatch(Base):
    __tablename__ = "gray_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_code = Column(String, unique=True, index=True, nullable=False)
    batch_name = Column(String, nullable=False)
    description = Column(Text)
    created_by = Column(String, nullable=False)
    status = Column(Enum(BatchStatus), default=BatchStatus.PENDING)
    override_strategy = Column(Enum(OverrideStrategy), default=OverrideStrategy.PROTECT)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    metric_windows = relationship("MetricWindow", back_populates="batch")
    audit_records = relationship("AuditRecord", back_populates="batch")
    result_snapshots = relationship("ResultSnapshot", back_populates="batch")
    exception_logs = relationship("ExceptionLog", back_populates="batch")


class MetricWindow(Base):
    __tablename__ = "metric_windows"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("gray_batches.id"), nullable=False)
    metric_name = Column(String, nullable=False, index=True)
    window_start = Column(DateTime(timezone=True), nullable=False)
    window_end = Column(DateTime(timezone=True), nullable=False)
    tags = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("GrayBatch", back_populates="metric_windows")
    gap_segments = relationship("GapSegment", back_populates="metric_window")


class GapSegment(Base):
    __tablename__ = "gap_segments"

    id = Column(Integer, primary_key=True, index=True)
    metric_window_id = Column(Integer, ForeignKey("metric_windows.id"), nullable=False)
    gap_type = Column(Enum(GapType), nullable=False)
    gap_start = Column(DateTime(timezone=True), nullable=False)
    gap_end = Column(DateTime(timezone=True), nullable=False)
    expected_points = Column(Integer)
    actual_points = Column(Integer)
    fill_rate = Column(Float)
    is_backfilled = Column(Boolean, default=False)
    backfilled_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    metric_window = relationship("MetricWindow", back_populates="gap_segments")
    backfill_sources = relationship("BackfillSource", back_populates="gap_segment")


class BackfillSource(Base):
    __tablename__ = "backfill_sources"

    id = Column(Integer, primary_key=True, index=True)
    gap_segment_id = Column(Integer, ForeignKey("gap_segments.id"), nullable=False)
    source_type = Column(Enum(SourceType), nullable=False)
    source_name = Column(String, nullable=False)
    source_config = Column(Text)
    data_hash = Column(String)
    record_count = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    gap_segment = relationship("GapSegment", back_populates="backfill_sources")


class AuditRecord(Base):
    __tablename__ = "audit_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("gray_batches.id"), nullable=False)
    from_status = Column(Enum(BatchStatus))
    to_status = Column(Enum(BatchStatus), nullable=False)
    operator = Column(String, nullable=False)
    comment = Column(Text)
    audit_time = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("GrayBatch", back_populates="audit_records")


class ResultSnapshot(Base):
    __tablename__ = "result_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("gray_batches.id"), nullable=False)
    snapshot_type = Column(String, nullable=False)
    snapshot_data = Column(Text, nullable=False)
    snapshot_hash = Column(String)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("GrayBatch", back_populates="result_snapshots")


class ExceptionLog(Base):
    __tablename__ = "exception_logs"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("gray_batches.id"))
    operation = Column(String, nullable=False)
    original_input = Column(Text)
    error_message = Column(Text)
    handler = Column(String)
    conclusion = Column(Text)
    handled_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("GrayBatch", back_populates="exception_logs")
