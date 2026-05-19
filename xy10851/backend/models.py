from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
import uuid


class OfflineDevice(Base):
    __tablename__ = "offline_devices"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    device_name = Column(String, nullable=False)
    device_type = Column(String, default="tablet")
    last_sync_time = Column(DateTime)
    status = Column(String, default="active")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    drafts = relationship("FormDraft", back_populates="device")
    sync_batches = relationship("SyncBatch", back_populates="device")


class FormDraft(Base):
    __tablename__ = "form_drafts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    form_type = Column(String, nullable=False)
    form_data = Column(JSON, nullable=False)
    version = Column(Integer, default=1)
    device_id = Column(String, ForeignKey("offline_devices.id"))
    status = Column(String, default="draft")
    created_by = Column(String)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    sync_batch_id = Column(String, ForeignKey("sync_batches.id"))

    device = relationship("OfflineDevice", back_populates="drafts")
    sync_batch = relationship("SyncBatch", back_populates="drafts")
    conflicts = relationship("FieldConflict", back_populates="draft")
    rollbacks = relationship("RollbackVersion", back_populates="draft")


class SyncBatch(Base):
    __tablename__ = "sync_batches"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id = Column(String, ForeignKey("offline_devices.id"))
    batch_number = Column(String, unique=True)
    status = Column(String, default="pending")
    total_items = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    conflict_count = Column(Integer, default=0)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    error_message = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    device = relationship("OfflineDevice", back_populates="sync_batches")
    drafts = relationship("FormDraft", back_populates="sync_batch")
    conflicts = relationship("FieldConflict", back_populates="batch")


class FieldConflict(Base):
    __tablename__ = "field_conflicts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    draft_id = Column(String, ForeignKey("form_drafts.id"))
    batch_id = Column(String, ForeignKey("sync_batches.id"))
    field_name = Column(String, nullable=False)
    server_value = Column(JSON)
    client_value = Column(JSON)
    base_version = Column(Integer)
    server_version = Column(Integer)
    client_version = Column(Integer)
    resolution_strategy = Column(String, default="manual")
    resolved = Column(Boolean, default=False)
    resolved_value = Column(JSON)
    resolved_by = Column(String)
    resolved_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    conflict_description = Column(Text)

    draft = relationship("FormDraft", back_populates="conflicts")
    batch = relationship("SyncBatch", back_populates="conflicts")


class MergeDecision(Base):
    __tablename__ = "merge_decisions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conflict_id = Column(String, ForeignKey("field_conflicts.id"))
    decision_type = Column(String, nullable=False)
    final_value = Column(JSON)
    decided_by = Column(String)
    decided_at = Column(DateTime, server_default=func.now())
    reason = Column(Text)


class RollbackVersion(Base):
    __tablename__ = "rollback_versions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    draft_id = Column(String, ForeignKey("form_drafts.id"))
    version_number = Column(Integer, nullable=False)
    form_data_snapshot = Column(JSON, nullable=False)
    rollback_reason = Column(Text)
    rolled_back_by = Column(String)
    rolled_back_at = Column(DateTime, server_default=func.now())

    draft = relationship("FormDraft", back_populates="rollbacks")
