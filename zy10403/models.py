from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base


class LeaseStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    RELEASED = "released"


class OperationType(str, enum.Enum):
    CREATE = "create"
    RENEW = "renew"
    RELEASE = "release"
    FORCE_RELEASE = "force_release"
    MANUAL_CORRECT = "manual_correct"
    QUERY = "query"


class Lease(Base):
    __tablename__ = "leases"

    id = Column(Integer, primary_key=True, index=True)
    branch_name = Column(String, index=True, nullable=False)
    env_id = Column(String, index=True, nullable=False)
    assignee = Column(String, index=True, nullable=False)
    lease_start = Column(DateTime, nullable=False)
    lease_end = Column(DateTime, nullable=False)
    renew_reason = Column(Text)
    status = Column(Enum(LeaseStatus), default=LeaseStatus.ACTIVE, nullable=False)
    request_id = Column(String, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    release_logs = relationship("ReleaseLog", back_populates="lease")


class ReleaseLog(Base):
    __tablename__ = "release_logs"

    id = Column(Integer, primary_key=True, index=True)
    lease_id = Column(Integer, ForeignKey("leases.id"), nullable=False)
    released_by = Column(String, nullable=False)
    release_reason = Column(Text)
    released_at = Column(DateTime(timezone=True), server_default=func.now())
    is_forced = Column(Boolean, default=False, nullable=False)

    lease = relationship("Lease", back_populates="release_logs")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    operation = Column(Enum(OperationType), nullable=False)
    raw_input = Column(Text, nullable=False)
    conclusion = Column(Text, nullable=False)
    operator = Column(String)
    success = Column(Boolean, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
