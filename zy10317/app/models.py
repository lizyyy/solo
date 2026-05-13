import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Enum, Float
from sqlalchemy.orm import relationship
from app.database import Base


class ChannelStatus(str, enum.Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    ERROR = "error"
    CLOSED = "closed"


class BatchStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    CONSUMED = "consumed"
    CONFIRMED = "confirmed"
    ROLLED_BACK = "rolled_back"
    ERROR = "error"


class SyncChannel(Base):
    __tablename__ = "sync_channels"

    id = Column(Integer, primary_key=True, index=True)
    channel_code = Column(String(100), unique=True, index=True, nullable=False)
    channel_name = Column(String(200), nullable=False)
    source_system = Column(String(100), nullable=False)
    target_system = Column(String(100), nullable=False)
    description = Column(Text)
    status = Column(Enum(ChannelStatus), default=ChannelStatus.ACTIVE)
    current_watermark = Column(String(200))
    current_watermark_time = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(100), default="system")
    updated_by = Column(String(100), default="system")

    watermarks = relationship("Watermark", back_populates="channel", cascade="all, delete-orphan")
    batches = relationship("SourceBatch", back_populates="channel", cascade="all, delete-orphan")
    rollback_points = relationship("RollbackPoint", back_populates="channel", cascade="all, delete-orphan")
    diff_summaries = relationship("DiffSummary", back_populates="channel", cascade="all, delete-orphan")


class Watermark(Base):
    __tablename__ = "watermarks"

    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(Integer, ForeignKey("sync_channels.id"), nullable=False)
    watermark_value = Column(String(200), nullable=False)
    watermark_time = Column(DateTime, nullable=False)
    sequence = Column(Integer, default=0)
    is_current = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(100), default="system")
    remark = Column(Text)

    channel = relationship("SyncChannel", back_populates="watermarks")
    confirmations = relationship("ConsumerConfirmation", back_populates="watermark", cascade="all, delete-orphan")


class SourceBatch(Base):
    __tablename__ = "source_batches"

    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(Integer, ForeignKey("sync_channels.id"), nullable=False)
    batch_id = Column(String(100), unique=True, index=True, nullable=False)
    start_watermark = Column(String(200), nullable=False)
    end_watermark = Column(String(200), nullable=False)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    record_count = Column(Integer, default=0)
    data_size = Column(Integer, default=0)
    status = Column(Enum(BatchStatus), default=BatchStatus.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    processed_by = Column(String(100))
    error_message = Column(Text)

    channel = relationship("SyncChannel", back_populates="batches")
    confirmations = relationship("ConsumerConfirmation", back_populates="batch", cascade="all, delete-orphan")


class ConsumerConfirmation(Base):
    __tablename__ = "consumer_confirmations"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("source_batches.id"), nullable=False)
    watermark_id = Column(Integer, ForeignKey("watermarks.id"), nullable=False)
    consumer_id = Column(String(100), nullable=False)
    confirmed_at = Column(DateTime, default=datetime.utcnow)
    confirmed_count = Column(Integer, default=0)
    success = Column(Boolean, default=True)
    error_message = Column(Text)
    processing_time_ms = Column(Float)

    batch = relationship("SourceBatch", back_populates="confirmations")
    watermark = relationship("Watermark", back_populates="confirmations")


class RollbackPoint(Base):
    __tablename__ = "rollback_points"

    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(Integer, ForeignKey("sync_channels.id"), nullable=False)
    watermark_value = Column(String(200), nullable=False)
    watermark_time = Column(DateTime, nullable=False)
    point_name = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(100), default="system")
    is_active = Column(Boolean, default=True)
    remark = Column(Text)

    channel = relationship("SyncChannel", back_populates="rollback_points")


class DiffSummary(Base):
    __tablename__ = "diff_summaries"

    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(Integer, ForeignKey("sync_channels.id"), nullable=False)
    scan_start_time = Column(DateTime, nullable=False)
    scan_end_time = Column(DateTime, nullable=False)
    start_watermark = Column(String(200), nullable=False)
    end_watermark = Column(String(200), nullable=False)
    source_count = Column(Integer, default=0)
    target_count = Column(Integer, default=0)
    diff_count = Column(Integer, default=0)
    missing_in_target = Column(Integer, default=0)
    missing_in_source = Column(Integer, default=0)
    mismatch_count = Column(Integer, default=0)
    scan_status = Column(String(50), default="completed")
    created_at = Column(DateTime, default=datetime.utcnow)
    scanned_by = Column(String(100), default="system")
    remark = Column(Text)

    channel = relationship("SyncChannel", back_populates="diff_summaries")
