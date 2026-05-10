from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, JSON, Enum, ForeignKey, Index
from sqlalchemy.orm import relationship
import enum
from app.database import Base


class EventStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSED = "processed"
    MANUAL_CORRECTED = "manual_corrected"
    DUPLICATE = "duplicate"
    ABORTED = "aborted"


class SnapshotSource(str, enum.Enum):
    REAL_TIME = "real_time"
    LATE_EVENT_CORRECTION = "late_event_correction"
    MANUAL = "manual"


class AlertStatus(str, enum.Enum):
    ACTIVE = "active"
    REVOKED = "revoked"
    CORRECTED = "corrected"


class RankingType(str, enum.Enum):
    DAILY = "daily"
    REALTIME = "realtime"


class CorrectionSource(str, enum.Enum):
    LATE_EVENT = "late_event"
    MANUAL = "manual"


class Event(Base):
    __tablename__ = "events"

    id = Column(String(64), primary_key=True, index=True)
    event_time = Column(DateTime, nullable=False, index=True)
    ingest_time = Column(DateTime, nullable=False, default=datetime.utcnow)
    metric_name = Column(String(64), nullable=False, index=True)
    metric_value = Column(Float, nullable=False)
    entity_id = Column(String(64), nullable=False, index=True)
    dimensions = Column(JSON, default={})
    status = Column(Enum(EventStatus), default=EventStatus.PENDING, index=True)
    is_late = Column(Boolean, default=False, index=True)
    latency_seconds = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_event_metric_entity_time", "metric_name", "entity_id", "event_time"),
    )


class LatencyWindow(Base):
    __tablename__ = "latency_windows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    metric_name = Column(String(64), nullable=False, unique=True, index=True)
    window_seconds = Column(Integer, nullable=False)
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MetricSnapshot(Base):
    __tablename__ = "metric_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    snapshot_time = Column(DateTime, nullable=False, index=True)
    metric_name = Column(String(64), nullable=False, index=True)
    entity_id = Column(String(64), nullable=False, index=True)
    bucket_time = Column(DateTime, nullable=False, index=True)
    value = Column(Float, nullable=False)
    version = Column(Integer, default=1)
    source = Column(Enum(SnapshotSource), default=SnapshotSource.REAL_TIME)
    is_latest = Column(Boolean, default=True, index=True)
    is_manual_overridden = Column(Boolean, default=False)
    event_ids = Column(JSON, default=[])
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_snapshot_metric_entity_bucket", "metric_name", "entity_id", "bucket_time"),
        Index("idx_snapshot_latest", "metric_name", "entity_id", "bucket_time", "is_latest"),
    )


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    alert_id = Column(String(64), nullable=False, unique=True, index=True)
    metric_name = Column(String(64), nullable=False, index=True)
    entity_id = Column(String(64), nullable=False, index=True)
    alert_time = Column(DateTime, nullable=False)
    bucket_time = Column(DateTime, nullable=False, index=True)
    threshold = Column(Float, nullable=False)
    original_value = Column(Float, nullable=False)
    current_value = Column(Float, nullable=False)
    alert_type = Column(String(32), nullable=False)
    status = Column(Enum(AlertStatus), default=AlertStatus.ACTIVE, index=True)
    revoked_time = Column(DateTime, nullable=True)
    revoke_reason = Column(String(255), nullable=True)
    snapshot_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Ranking(Base):
    __tablename__ = "rankings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ranking_type = Column(Enum(RankingType), nullable=False, index=True)
    metric_name = Column(String(64), nullable=False, index=True)
    ranking_date = Column(DateTime, nullable=False, index=True)
    entity_id = Column(String(64), nullable=False, index=True)
    rank = Column(Integer, nullable=False)
    value = Column(Float, nullable=False)
    version = Column(Integer, default=1)
    is_latest = Column(Boolean, default=True, index=True)
    is_replayed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_ranking_key", "ranking_type", "metric_name", "ranking_date", "is_latest"),
    )


class CorrectionReport(Base):
    __tablename__ = "correction_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    report_id = Column(String(64), nullable=False, unique=True, index=True)
    correction_time = Column(DateTime, nullable=False)
    metric_name = Column(String(64), nullable=False, index=True)
    entity_id = Column(String(64), nullable=False, index=True)
    event_time = Column(DateTime, nullable=True)
    bucket_time = Column(DateTime, nullable=False, index=True)
    original_value = Column(Float, nullable=False)
    new_value = Column(Float, nullable=False)
    source = Column(Enum(CorrectionSource), nullable=False)
    affected_alerts = Column(JSON, default=[])
    affected_rankings = Column(JSON, default=[])
    operator = Column(String(64), nullable=True)
    reason = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
