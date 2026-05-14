from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from .database import Base


class SyncStatusEnum(str, enum.Enum):
    PENDING = "pending"
    SYNCING = "syncing"
    SUCCESS = "success"
    FAILED = "failed"
    CONFLICT = "conflict"
    OFFLINE = "offline"


class ConflictStatusEnum(str, enum.Enum):
    PENDING = "pending"
    RESOLVED = "resolved"
    REJECTED = "rejected"


class NodeGroup(Base):
    __tablename__ = "node_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True)
    description = Column(Text)
    node_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    config_versions = relationship("ConfigVersion", back_populates="node_group")
    sync_statuses = relationship("SyncStatus", back_populates="node_group")


class ConfigVersion(Base):
    __tablename__ = "config_versions"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String(50), index=True)
    node_group_id = Column(Integer, ForeignKey("node_groups.id"))
    config_content = Column(Text)
    description = Column(Text)
    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    node_group = relationship("NodeGroup", back_populates="config_versions")
    sync_statuses = relationship("SyncStatus", back_populates="config_version")


class SyncStatus(Base):
    __tablename__ = "sync_statuses"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String(100), unique=True, index=True)
    node_group_id = Column(Integer, ForeignKey("node_groups.id"))
    config_version_id = Column(Integer, ForeignKey("config_versions.id"))
    status = Column(Enum(SyncStatusEnum), default=SyncStatusEnum.PENDING)
    total_nodes = Column(Integer, default=0)
    success_nodes = Column(Integer, default=0)
    failed_nodes = Column(Integer, default=0)
    offline_nodes = Column(Integer, default=0)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    created_by = Column(String(100))

    node_group = relationship("NodeGroup", back_populates="sync_statuses")
    config_version = relationship("ConfigVersion", back_populates="sync_statuses")
    offline_node_list = relationship("OfflineNode", back_populates="sync_status")
    conflicts = relationship("ConflictResolution", back_populates="sync_status")
    audits = relationship("SyncAudit", back_populates="sync_status")


class OfflineNode(Base):
    __tablename__ = "offline_nodes"

    id = Column(Integer, primary_key=True, index=True)
    sync_status_id = Column(Integer, ForeignKey("sync_statuses.id"))
    node_name = Column(String(100))
    node_ip = Column(String(50))
    last_seen = Column(DateTime)
    retry_count = Column(Integer, default=0)
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime)

    sync_status = relationship("SyncStatus", back_populates="offline_node_list")


class ConflictResolution(Base):
    __tablename__ = "conflict_resolutions"

    id = Column(Integer, primary_key=True, index=True)
    sync_status_id = Column(Integer, ForeignKey("sync_statuses.id"))
    node_name = Column(String(100))
    current_version = Column(String(50))
    target_version = Column(String(50))
    conflict_detail = Column(Text)
    status = Column(Enum(ConflictStatusEnum), default=ConflictStatusEnum.PENDING)
    resolution = Column(Text)
    resolved_by = Column(String(100))
    resolved_at = Column(DateTime)

    sync_status = relationship("SyncStatus", back_populates="conflicts")


class SyncAudit(Base):
    __tablename__ = "sync_audits"

    id = Column(Integer, primary_key=True, index=True)
    sync_status_id = Column(Integer, ForeignKey("sync_statuses.id"))
    action = Column(String(50))
    operator = Column(String(100))
    detail = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    sync_status = relationship("SyncStatus", back_populates="audits")


class IdempotentRequest(Base):
    __tablename__ = "idempotent_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_key = Column(String(100), unique=True, index=True)
    request_type = Column(String(50))
    response_data = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
