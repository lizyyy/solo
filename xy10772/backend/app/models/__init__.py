from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum

class GrayStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    RUNNING = "running"
    PAUSED = "paused"
    SUCCESS = "success"
    BLOCKED = "blocked"
    COMPENSATED = "compensated"
    CANCELLED = "cancelled"

class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class DeviceChannel(Base):
    __tablename__ = "device_channels"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class AppVersion(Base):
    __tablename__ = "app_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    version = Column(String(50), nullable=False)
    build_number = Column(String(50))
    channel_id = Column(Integer, ForeignKey("device_channels.id"))
    download_url = Column(String(500))
    file_size = Column(Float)
    release_notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    channel = relationship("DeviceChannel")

class GrayRule(Base):
    __tablename__ = "gray_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String(100), unique=True, index=True)
    name = Column(String(200), nullable=False)
    version_id = Column(Integer, ForeignKey("app_versions.id"))
    target_version_id = Column(Integer, ForeignKey("app_versions.id"))
    gray_ratio = Column(Float, default=0)
    crash_rate_threshold = Column(Float, default=0.01)
    status = Column(Enum(GrayStatus), default=GrayStatus.DRAFT)
    device_channels = Column(Text)
    white_list = Column(Text)
    black_list = Column(Text)
    description = Column(Text)
    created_by = Column(String(100))
    approved_by = Column(String(100))
    approved_at = Column(DateTime(timezone=True))
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    version = relationship("AppVersion", foreign_keys=[version_id])
    target_version = relationship("AppVersion", foreign_keys=[target_version_id])
    approvals = relationship("ApprovalRecord", back_populates="gray_rule")

class ApprovalRecord(Base):
    __tablename__ = "approval_records"
    
    id = Column(Integer, primary_key=True, index=True)
    gray_rule_id = Column(Integer, ForeignKey("gray_rules.id"))
    approver = Column(String(100), nullable=False)
    status = Column(Enum(ApprovalStatus), default=ApprovalStatus.PENDING)
    comment = Column(Text)
    approved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    gray_rule = relationship("GrayRule", back_populates="approvals")

class GrayDevice(Base):
    __tablename__ = "gray_devices"
    
    id = Column(Integer, primary_key=True, index=True)
    gray_rule_id = Column(Integer, ForeignKey("gray_rules.id"))
    device_id = Column(String(100), index=True)
    device_channel = Column(String(50))
    is_gray = Column(Boolean, default=False)
    upgraded_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class CrashReport(Base):
    __tablename__ = "crash_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    gray_rule_id = Column(Integer, ForeignKey("gray_rules.id"))
    device_id = Column(String(100))
    version = Column(String(50))
    crash_type = Column(String(100))
    crash_log = Column(Text)
    reported_at = Column(DateTime(timezone=True), server_default=func.now())

class ReleaseRecord(Base):
    __tablename__ = "release_records"
    
    id = Column(Integer, primary_key=True, index=True)
    gray_rule_id = Column(Integer, ForeignKey("gray_rules.id"))
    release_type = Column(String(50))
    status = Column(String(50))
    details = Column(Text)
    released_by = Column(String(100))
    released_at = Column(DateTime(timezone=True), server_default=func.now())

class GrayStats(Base):
    __tablename__ = "gray_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    gray_rule_id = Column(Integer, ForeignKey("gray_rules.id"))
    total_devices = Column(Integer, default=0)
    gray_devices = Column(Integer, default=0)
    upgrade_count = Column(Integer, default=0)
    crash_count = Column(Integer, default=0)
    crash_rate = Column(Float, default=0)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())
