from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text, Date, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base
import enum

class MemberStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"

class CoachStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"

class PackageStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    DEPLETED = "depleted"
    TRANSFERRED = "transferred"

class AppointmentStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    ATTENDED = "attended"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"
    LEAVE = "leave"

class DeductionReason(str, enum.Enum):
    ATTENDED = "attended"
    NO_SHOW = "no_show"
    LATE_CANCEL = "late_cancel"
    TRANSFER = "transfer"
    MANUAL_ADJUST = "manual_adjust"

class Member(Base):
    __tablename__ = "members"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), unique=True, nullable=False)
    status = Column(SQLEnum(MemberStatus), default=MemberStatus.ACTIVE)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Coach(Base):
    __tablename__ = "coaches"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), unique=True, nullable=False)
    commission_rate = Column(Float, default=0.5)
    status = Column(SQLEnum(CoachStatus), default=CoachStatus.ACTIVE)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Package(Base):
    __tablename__ = "packages"
    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    coach_id = Column(Integer, ForeignKey("coaches.id"), nullable=False)
    total_sessions = Column(Integer, nullable=False)
    used_sessions = Column(Integer, default=0)
    remaining_sessions = Column(Integer, nullable=False)
    purchase_date = Column(Date, nullable=False)
    expire_date = Column(Date, nullable=False)
    status = Column(SQLEnum(PackageStatus), default=PackageStatus.ACTIVE)
    price = Column(Float, default=0)
    per_session_price = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    member = relationship("Member")
    coach = relationship("Coach")

class Appointment(Base):
    __tablename__ = "appointments"
    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    coach_id = Column(Integer, ForeignKey("coaches.id"), nullable=False)
    package_id = Column(Integer, ForeignKey("packages.id"), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    status = Column(SQLEnum(AppointmentStatus), default=AppointmentStatus.PENDING)
    deduction_applied = Column(Boolean, default=False)
    deduction_id = Column(Integer, ForeignKey("deductions.id"), nullable=True)
    commission_id = Column(Integer, ForeignKey("commissions.id"), nullable=True)
    request_id = Column(String(100), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    member = relationship("Member")
    coach = relationship("Coach")
    package = relationship("Package")

class Leave(Base):
    __tablename__ = "leaves"
    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False)
    request_time = Column(DateTime, default=datetime.utcnow)
    is_before_cutoff = Column(Boolean, nullable=False)
    reason = Column(String(500), nullable=True)
    request_id = Column(String(100), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    appointment = relationship("Appointment")

class NoShow(Base):
    __tablename__ = "no_shows"
    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False)
    record_time = Column(DateTime, default=datetime.utcnow)
    reason = Column(String(500), nullable=True)
    request_id = Column(String(100), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    appointment = relationship("Appointment")

class Transfer(Base):
    __tablename__ = "transfers"
    id = Column(Integer, primary_key=True, index=True)
    from_member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    to_member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    package_id = Column(Integer, ForeignKey("packages.id"), nullable=False)
    transfer_sessions = Column(Integer, nullable=False)
    transfer_date = Column(DateTime, default=datetime.utcnow)
    request_id = Column(String(100), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    from_member = relationship("Member", foreign_keys=[from_member_id])
    to_member = relationship("Member", foreign_keys=[to_member_id])
    package = relationship("Package")

class Deduction(Base):
    __tablename__ = "deductions"
    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    coach_id = Column(Integer, ForeignKey("coaches.id"), nullable=False)
    package_id = Column(Integer, ForeignKey("packages.id"), nullable=False)
    sessions = Column(Integer, nullable=False)
    reason = Column(SQLEnum(DeductionReason), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    transfer_id = Column(Integer, ForeignKey("transfers.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Commission(Base):
    __tablename__ = "commissions"
    id = Column(Integer, primary_key=True, index=True)
    coach_id = Column(Integer, ForeignKey("coaches.id"), nullable=False)
    deduction_id = Column(Integer, ForeignKey("deductions.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    sessions = Column(Integer, nullable=False)
    per_session_amount = Column(Float, nullable=False)
    total_amount = Column(Float, nullable=False)
    commission_rate = Column(Float, nullable=False)
    settlement_date = Column(Date, nullable=False)
    is_settled = Column(Boolean, default=False)
    settled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class StatusHistory(Base):
    __tablename__ = "status_histories"
    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False)
    from_status = Column(String(50), nullable=True)
    to_status = Column(String(50), nullable=False)
    action = Column(String(100), nullable=False)
    request_id = Column(String(100), nullable=True)
    operator = Column(String(100), nullable=True)
    reason = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class ManualCorrection(Base):
    __tablename__ = "manual_corrections"
    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False)
    before_data = Column(Text, nullable=False)
    after_data = Column(Text, nullable=False)
    operator = Column(String(100), nullable=False)
    reason = Column(String(500), nullable=False)
    request_id = Column(String(100), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class IdempotencyLog(Base):
    __tablename__ = "idempotency_logs"
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String(100), unique=True, nullable=False)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=True)
    status = Column(String(50), nullable=False)
    response_data = Column(Text, nullable=True)
    error_message = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
