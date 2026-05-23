from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class ParkingSpotStatus(enum.Enum):
    AVAILABLE = "available"
    LOCKED = "locked"
    OCCUPIED = "occupied"
    MAINTENANCE = "maintenance"


class MeetingStatus(enum.Enum):
    SCHEDULED = "scheduled"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    IN_PROGRESS = "in_progress"


class PassCodeStatus(enum.Enum):
    ACTIVE = "active"
    USED = "used"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class RequestStatus(enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    PENDING_REVIEW = "pending_review"
    COMPENSATED = "compensated"


class Visitor(Base):
    __tablename__ = "visitors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=False)
    company = Column(String(200))
    id_card = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    appointments = relationship("MeetingAppointment", back_populates="visitor")


class ParkingSpot(Base):
    __tablename__ = "parking_spots"

    id = Column(Integer, primary_key=True, index=True)
    spot_number = Column(String(20), unique=True, nullable=False)
    area = Column(String(50))
    level = Column(String(20))
    status = Column(String(20), default=ParkingSpotStatus.AVAILABLE.value)
    is_temporary = Column(Boolean, default=True)
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    appointments = relationship("MeetingAppointment", back_populates="parking_spot")


class MeetingAppointment(Base):
    __tablename__ = "meeting_appointments"

    id = Column(Integer, primary_key=True, index=True)
    visitor_id = Column(Integer, ForeignKey("visitors.id"))
    parking_spot_id = Column(Integer, ForeignKey("parking_spots.id"))
    meeting_room = Column(String(100))
    host_name = Column(String(100))
    host_phone = Column(String(20))
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), default=MeetingStatus.SCHEDULED.value)
    request_status = Column(String(20), default=RequestStatus.APPROVED.value)
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    visitor = relationship("Visitor", back_populates="appointments")
    parking_spot = relationship("ParkingSpot", back_populates="appointments")
    pass_codes = relationship("PassCode", back_populates="appointment")
    cancel_records = relationship("CancelRecord", back_populates="appointment")


class PassCode(Base):
    __tablename__ = "pass_codes"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("meeting_appointments.id"))
    code = Column(String(20), unique=True, nullable=False)
    status = Column(String(20), default=PassCodeStatus.ACTIVE.value)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    used_at = Column(DateTime(timezone=True))
    expired_at = Column(DateTime(timezone=True), nullable=False)
    used_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    appointment = relationship("MeetingAppointment", back_populates="pass_codes")


class CancelRecord(Base):
    __tablename__ = "cancel_records"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("meeting_appointments.id"))
    cancel_reason = Column(Text)
    cancelled_by = Column(String(100))
    cancelled_at = Column(DateTime(timezone=True), server_default=func.now())
    spot_released = Column(Boolean, default=True)
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    appointment = relationship("MeetingAppointment", back_populates="cancel_records")


class OccupancyReport(Base):
    __tablename__ = "occupancy_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_date = Column(DateTime(timezone=True), nullable=False)
    total_spots = Column(Integer, default=0)
    occupied_spots = Column(Integer, default=0)
    available_spots = Column(Integer, default=0)
    locked_spots = Column(Integer, default=0)
    cancelled_appointments = Column(Integer, default=0)
    released_spots = Column(Integer, default=0)
    utilization_rate = Column(Float, default=0.0)
    generated_by = Column(String(100))
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ExceptionLog(Base):
    __tablename__ = "exception_logs"

    id = Column(Integer, primary_key=True, index=True)
    request_path = Column(String(200))
    request_method = Column(String(20))
    raw_input = Column(Text)
    error_message = Column(Text)
    error_type = Column(String(100))
    processing_result = Column(String(50))
    processing_notes = Column(Text)
    handled_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    handled_at = Column(DateTime(timezone=True))
