from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class FreezeStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class ChangeStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    BLOCKED = "blocked"
    EXCEPTION = "exception"
    EMERGENCY = "emergency"


class ExceptionStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ApprovalRole(str, enum.Enum):
    ADMIN = "admin"
    OWNER = "owner"
    REVIEWER = "reviewer"


class ServiceGroup(Base):
    __tablename__ = "service_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    freezes = relationship("FreezeCalendar", back_populates="service_group")
    changes = relationship("ChangeOrder", back_populates="service_group")


class FreezeCalendar(Base):
    __tablename__ = "freeze_calendars"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    service_group_id = Column(Integer, ForeignKey("service_groups.id"), nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    reason = Column(Text)
    status = Column(Enum(FreezeStatus), default=FreezeStatus.ACTIVE)
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    service_group = relationship("ServiceGroup", back_populates="freezes")
    exceptions = relationship("ExceptionRequest", back_populates="freeze")
    block_logs = relationship("BlockLog", back_populates="freeze")


class Approver(Base):
    __tablename__ = "approvers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(100), unique=True, index=True, nullable=False)
    user_name = Column(String(100), nullable=False)
    email = Column(String(100))
    role = Column(Enum(ApprovalRole), default=ApprovalRole.REVIEWER)
    service_group_id = Column(Integer, ForeignKey("service_groups.id"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ChangeOrder(Base):
    __tablename__ = "change_orders"

    id = Column(Integer, primary_key=True, index=True)
    change_id = Column(String(100), unique=True, index=True, nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    service_group_id = Column(Integer, ForeignKey("service_groups.id"), nullable=False)
    planned_time = Column(DateTime(timezone=True), nullable=False)
    requester = Column(String(100), nullable=False)
    status = Column(Enum(ChangeStatus), default=ChangeStatus.PENDING)
    idempotency_key = Column(String(100), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    service_group = relationship("ServiceGroup", back_populates="changes")
    exceptions = relationship("ExceptionRequest", back_populates="change")
    block_logs = relationship("BlockLog", back_populates="change")


class ExceptionRequest(Base):
    __tablename__ = "exception_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String(100), unique=True, index=True, nullable=False)
    change_id = Column(Integer, ForeignKey("change_orders.id"), nullable=False)
    freeze_id = Column(Integer, ForeignKey("freeze_calendars.id"), nullable=False)
    reason = Column(Text, nullable=False)
    requester = Column(String(100), nullable=False)
    approver = Column(String(100))
    status = Column(Enum(ExceptionStatus), default=ExceptionStatus.PENDING)
    is_emergency = Column(Boolean, default=False)
    approved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    change = relationship("ChangeOrder", back_populates="exceptions")
    freeze = relationship("FreezeCalendar", back_populates="exceptions")


class BlockLog(Base):
    __tablename__ = "block_logs"

    id = Column(Integer, primary_key=True, index=True)
    change_id = Column(Integer, ForeignKey("change_orders.id"), nullable=False)
    freeze_id = Column(Integer, ForeignKey("freeze_calendars.id"), nullable=False)
    block_time = Column(DateTime(timezone=True), server_default=func.now())
    reason = Column(Text)
    resolved = Column(Boolean, default=False)
    resolved_by = Column(String(100))
    resolved_at = Column(DateTime(timezone=True))

    change = relationship("ChangeOrder", back_populates="block_logs")
    freeze = relationship("FreezeCalendar", back_populates="block_logs")
