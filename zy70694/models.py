from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class RoomStatus(str, enum.Enum):
    AVAILABLE = "available"
    BOOKED = "booked"
    OCCUPIED = "occupied"
    MAINTENANCE = "maintenance"


class BookingStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CHECKED_IN = "checked_in"
    LATE = "late"
    RELEASED = "released"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class RenewalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class PianoRoom(Base):
    __tablename__ = "piano_rooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    room_type = Column(String)
    hourly_rate = Column(Float, nullable=False)
    status = Column(String, default=RoomStatus.AVAILABLE)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    bookings = relationship("Booking", back_populates="room")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    bookings = relationship("Booking", back_populates="user")
    late_records = relationship("LateRecord", back_populates="user")


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("piano_rooms.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    booking_date = Column(String, nullable=False)
    start_time = Column(String, nullable=False)
    end_time = Column(String, nullable=False)
    duration_hours = Column(Float, nullable=False)
    total_amount = Column(Float, nullable=False)
    status = Column(String, default=BookingStatus.PENDING)
    check_in_time = Column(DateTime(timezone=True))
    check_out_time = Column(DateTime(timezone=True))
    is_late_released = Column(Boolean, default=False)
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    room = relationship("PianoRoom", back_populates="bookings")
    user = relationship("User", back_populates="bookings")
    late_record = relationship("LateRecord", back_populates="booking", uselist=False)
    renewal_applications = relationship("RenewalApplication", back_populates="booking")


class LateRecord(Base):
    __tablename__ = "late_records"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False, unique=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    late_minutes = Column(Integer, nullable=False)
    released_at = Column(DateTime(timezone=True))
    is_released = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    booking = relationship("Booking", back_populates="late_record")
    user = relationship("User", back_populates="late_records")


class RenewalApplication(Base):
    __tablename__ = "renewal_applications"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False)
    extend_hours = Column(Float, nullable=False)
    new_end_time = Column(String, nullable=False)
    additional_amount = Column(Float, nullable=False)
    status = Column(String, default=RenewalStatus.PENDING)
    approved_at = Column(DateTime(timezone=True))
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    booking = relationship("Booking", back_populates="renewal_applications")
