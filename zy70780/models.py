import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from database import Base


class AuditStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    NEEDS_REVIEW = "needs_review"
    RESOLVED = "resolved"
    CLOSED = "closed"


class PackageStatus(str, enum.Enum):
    NORMAL = "normal"
    ABNORMAL = "abnormal"
    CONFLICT = "conflict"
    UNVERIFIED = "unverified"


class LockfileAudit(Base):
    __tablename__ = "lockfile_audits"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    lockfile_type = Column(String, index=True)
    content_hash = Column(String, index=True)
    status = Column(Enum(AuditStatus), default=AuditStatus.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String, nullable=True)
    notes = Column(Text, nullable=True)

    packages = relationship("PackageAudit", back_populates="lockfile_audit")
    exceptions = relationship("AuditException", back_populates="lockfile_audit")


class PackageAudit(Base):
    __tablename__ = "package_audits"

    id = Column(Integer, primary_key=True, index=True)
    lockfile_audit_id = Column(Integer, ForeignKey("lockfile_audits.id"))
    package_name = Column(String, index=True)
    version = Column(String, index=True)
    registry = Column(String, index=True)
    integrity_hash = Column(String, index=True)
    expected_hash = Column(String, nullable=True)
    status = Column(Enum(PackageStatus), default=PackageStatus.UNVERIFIED)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lockfile_audit = relationship("LockfileAudit", back_populates="packages")
    source_reports = relationship("SourceReport", back_populates="package_audit")


class SourceReport(Base):
    __tablename__ = "source_reports"

    id = Column(Integer, primary_key=True, index=True)
    package_audit_id = Column(Integer, ForeignKey("package_audits.id"))
    registry_url = Column(String)
    found = Column(Boolean, default=False)
    hash_match = Column(Boolean, default=False)
    response_data = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    checked_at = Column(DateTime, default=datetime.utcnow)

    package_audit = relationship("PackageAudit", back_populates="source_reports")


class AuditException(Base):
    __tablename__ = "audit_exceptions"

    id = Column(Integer, primary_key=True, index=True)
    lockfile_audit_id = Column(Integer, ForeignKey("lockfile_audits.id"))
    package_name = Column(String, index=True, nullable=True)
    original_input = Column(Text)
    handler = Column(String, nullable=True)
    conclusion = Column(Text, nullable=True)
    resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lockfile_audit = relationship("LockfileAudit", back_populates="exceptions")
