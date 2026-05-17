from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class BookingStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CONSUMED = "consumed"
    CANCELLED = "cancelled"
    SUBSTITUTE_REQUESTED = "substitute_requested"
    SUBSTITUTE_CONFIRMED = "substitute_confirmed"
    LEAVE_APPLIED = "leave_applied"
    LEAVE_APPROVED = "leave_approved"
    MAKEUP_SCHEDULED = "makeup_scheduled"


class LeaveStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class SubstituteStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class MemberCard(Base):
    __tablename__ = "member_cards"

    id = Column(Integer, primary_key=True, index=True)
    member_name = Column(String(100), nullable=False)
    member_phone = Column(String(20), unique=True, index=True)
    card_number = Column(String(50), unique=True, index=True)
    total_hours = Column(Integer, nullable=False)
    used_hours = Column(Integer, default=0)
    frozen_hours = Column(Integer, default=0)
    remaining_hours = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    course_packages = relationship("CoursePackage", back_populates="member_card")
    bookings = relationship("Booking", back_populates="member_card")


class CoursePackage(Base):
    __tablename__ = "course_packages"

    id = Column(Integer, primary_key=True, index=True)
    member_card_id = Column(Integer, ForeignKey("member_cards.id"))
    package_name = Column(String(100), nullable=False)
    course_type = Column(String(50))
    total_hours = Column(Integer, nullable=False)
    used_hours = Column(Integer, default=0)
    frozen_hours = Column(Integer, default=0)
    remaining_hours = Column(Integer, nullable=False)
    purchase_date = Column(DateTime(timezone=True), server_default=func.now())
    expire_date = Column(DateTime(timezone=True))
    coach_id = Column(Integer, ForeignKey("coaches.id"))

    member_card = relationship("MemberCard", back_populates="course_packages")
    bookings = relationship("Booking", back_populates="course_package")
    coach = relationship("Coach")


class Coach(Base):
    __tablename__ = "coaches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), unique=True, index=True)
    specialty = Column(String(100))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    bookings_as_main = relationship("Booking", back_populates="main_coach")
    substitute_requests = relationship("SubstituteRecord", back_populates="substitute_coach")


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    member_card_id = Column(Integer, ForeignKey("member_cards.id"))
    course_package_id = Column(Integer, ForeignKey("course_packages.id"))
    main_coach_id = Column(Integer, ForeignKey("coaches.id"))
    booking_date = Column(DateTime(timezone=True), nullable=False)
    start_time = Column(String(10), nullable=False)
    end_time = Column(String(10), nullable=False)
    hours = Column(Integer, default=1)
    status = Column(String(20), default=BookingStatus.PENDING)
    notes = Column(Text)
    is_makeup = Column(Boolean, default=False)
    makeup_for_booking_id = Column(Integer, ForeignKey("bookings.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(50))
    consumed_at = Column(DateTime(timezone=True))
    consumed_by = Column(String(50))

    member_card = relationship("MemberCard", back_populates="bookings")
    course_package = relationship("CoursePackage", back_populates="bookings")
    main_coach = relationship("Coach", back_populates="bookings_as_main")
    leave_application = relationship("LeaveApplication", back_populates="booking", uselist=False)
    substitute_records = relationship("SubstituteRecord", back_populates="booking")
    consumption_records = relationship("ConsumptionRecord", back_populates="booking")


class LeaveApplication(Base):
    __tablename__ = "leave_applications"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"))
    reason = Column(Text, nullable=False)
    status = Column(String(20), default=LeaveStatus.PENDING)
    applied_at = Column(DateTime(timezone=True), server_default=func.now())
    approved_at = Column(DateTime(timezone=True))
    approved_by = Column(String(50))
    rejection_reason = Column(Text)
    freeze_hours = Column(Boolean, default=True)

    booking = relationship("Booking", back_populates="leave_application")


class SubstituteRecord(Base):
    __tablename__ = "substitute_records"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"))
    substitute_coach_id = Column(Integer, ForeignKey("coaches.id"))
    original_coach_id = Column(Integer, ForeignKey("coaches.id"))
    reason = Column(Text)
    status = Column(String(20), default=SubstituteStatus.PENDING)
    requested_at = Column(DateTime(timezone=True), server_default=func.now())
    confirmed_at = Column(DateTime(timezone=True))
    confirmed_by = Column(String(50))
    rejection_reason = Column(Text)

    booking = relationship("Booking", back_populates="substitute_records")
    substitute_coach = relationship("Coach", back_populates="substitute_requests", foreign_keys=[substitute_coach_id])


class ConsumptionRecord(Base):
    __tablename__ = "consumption_records"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"))
    member_card_id = Column(Integer, ForeignKey("member_cards.id"))
    course_package_id = Column(Integer, ForeignKey("course_packages.id"))
    coach_id = Column(Integer, ForeignKey("coaches.id"))
    hours = Column(Integer, nullable=False)
    consumed_at = Column(DateTime(timezone=True), server_default=func.now())
    consumed_by = Column(String(50))
    notes = Column(Text)
    is_rollback = Column(Boolean, default=False)
    rollback_reason = Column(Text)
    rollback_by = Column(String(50))
    rollback_at = Column(DateTime(timezone=True))

    booking = relationship("Booking", back_populates="consumption_records")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String(50), nullable=False)
    target_type = Column(String(50))
    target_id = Column(Integer)
    original_input = Column(Text)
    handler = Column(String(50))
    conclusion = Column(String(50))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    success = Column(Boolean, default=True)
