from enum import Enum
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, JSON, Boolean, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

Base = declarative_base()


class CleanupStatus(str, Enum):
    PENDING = "pending"
    INVENTORYING = "inventorying"
    INVENTORY_DONE = "inventory_done"
    PRESERVATION_CHECKING = "preservation_checking"
    READY_TO_CLEAN = "ready_to_clean"
    CLEANING = "cleaning"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    REVOKED = "revoked"
    ERROR = "error"


class PreservationTag(str, Enum):
    UNDER_INVESTIGATION = "under_investigation"
    EVIDENCE = "evidence"
    PENDING_REVIEW = "pending_review"
    NO_PRESERVATION = "no_preservation"


class SandboxCleanup(Base):
    __tablename__ = "sandbox_cleanups"

    id = Column(Integer, primary_key=True, index=True)
    sandbox_id = Column(String, index=True, nullable=False)
    preservation_tag = Column(String, default=PreservationTag.NO_PRESERVATION)
    status = Column(String, default=CleanupStatus.PENDING)
    resource_inventory = Column(JSON, default=list)
    cleanup_plan = Column(JSON, default=dict)
    scheduled_time = Column(DateTime)
    started_time = Column(DateTime)
    completed_time = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String)
    assignee = Column(String)
    remarks = Column(Text)
    revoke_reason = Column(Text)
    revoked_by = Column(String)
    revoked_at = Column(DateTime)
    error_message = Column(Text)
    raw_input = Column(JSON)
    processing_conclusion = Column(Text)
    is_manually_modified = Column(Boolean, default=False)
    modified_by = Column(String)
    modified_at = Column(DateTime)
    modification_reason = Column(Text)

    summary = relationship("CleanupSummary", back_populates="cleanup", uselist=False)
    audit_logs = relationship("AuditLog", back_populates="cleanup")


class CleanupSummary(Base):
    __tablename__ = "cleanup_summaries"

    id = Column(Integer, primary_key=True, index=True)
    cleanup_id = Column(Integer, ForeignKey("sandbox_cleanups.id"), unique=True)
    sandbox_id = Column(String, index=True)
    total_resources = Column(Integer, default=0)
    preserved_resources = Column(Integer, default=0)
    cleaned_resources = Column(Integer, default=0)
    failed_resources = Column(Integer, default=0)
    resource_details = Column(JSON, default=list)
    duration_seconds = Column(Integer)
    completed_by = Column(String)
    completed_at = Column(DateTime)
    export_format = Column(String)
    exported_at = Column(DateTime)
    exported_by = Column(String)

    cleanup = relationship("SandboxCleanup", back_populates="summary")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    cleanup_id = Column(Integer, ForeignKey("sandbox_cleanups.id"))
    action = Column(String, nullable=False)
    from_status = Column(String)
    to_status = Column(String)
    operator = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)
    details = Column(JSON)
    raw_input_snapshot = Column(JSON)
    processing_notes = Column(Text)

    cleanup = relationship("SandboxCleanup", back_populates="audit_logs")


class ResourceItem(BaseModel):
    resource_id: str
    resource_type: str
    resource_name: str
    size_bytes: Optional[int] = None
    created_at: Optional[str] = None
    should_preserve: bool = False
    preserve_reason: Optional[str] = None


class CleanupPlan(BaseModel):
    estimated_resources: int
    estimated_duration_minutes: int
    priority: str = "normal"
    cleanup_scope: List[str] = Field(default_factory=lambda: ["files", "processes", "network"])


class SandboxCleanupCreate(BaseModel):
    sandbox_id: str
    preservation_tag: PreservationTag = PreservationTag.NO_PRESERVATION
    scheduled_time: Optional[datetime] = None
    created_by: str
    assignee: Optional[str] = None
    remarks: Optional[str] = None
    resource_inventory: Optional[List[ResourceItem]] = None
    cleanup_plan: Optional[CleanupPlan] = None
    raw_input: Optional[Dict[str, Any]] = None


class SandboxCleanupUpdate(BaseModel):
    preservation_tag: Optional[PreservationTag] = None
    assignee: Optional[str] = None
    remarks: Optional[str] = None
    scheduled_time: Optional[datetime] = None
    resource_inventory: Optional[List[ResourceItem]] = None
    cleanup_plan: Optional[CleanupPlan] = None


class StatusTransition(BaseModel):
    target_status: CleanupStatus
    operator: str
    details: Optional[Dict[str, Any]] = None
    processing_conclusion: Optional[str] = None


class ManualCorrection(BaseModel):
    corrected_status: CleanupStatus
    modified_by: str
    modification_reason: str
    details: Optional[Dict[str, Any]] = None


class RevokeRequest(BaseModel):
    revoke_reason: str
    revoked_by: str
    details: Optional[Dict[str, Any]] = None


class ErrorRecord(BaseModel):
    error_message: str
    operator: str
    raw_input_snapshot: Optional[Dict[str, Any]] = None
    processing_notes: Optional[str] = None


class ExportFilter(BaseModel):
    status: Optional[List[CleanupStatus]] = None
    sandbox_id: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    has_preservation: Optional[bool] = None
    export_format: str = "json"


class CleanupSummaryExport(BaseModel):
    cleanup_id: int
    sandbox_id: str
    status: str
    preservation_tag: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    total_resources: int
    preserved_resources: int
    cleaned_resources: int
    failed_resources: int
    duration_seconds: Optional[int] = None
    revoke_reason: Optional[str] = None
    error_message: Optional[str] = None
    processing_conclusion: Optional[str] = None
    is_manually_modified: bool
    modification_reason: Optional[str] = None
