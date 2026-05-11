from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from .database import Base


class VisitorStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class ReservationStatus(str, enum.Enum):
    PENDING = "pending"
    LOCKED = "locked"
    CONFIRMED = "confirmed"
    IN_USE = "in_use"
    EXTENDED = "extended"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class ParkingSpot(Base):
    __tablename__ = "parking_spots"

    id = Column(Integer, primary_key=True, index=True)
    spot_number = Column(String, unique=True, index=True)
    zone = Column(String)
    is_visitor_spot = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)

    reservations = relationship("ParkingReservation", back_populates="spot")


class Visitor(Base):
    __tablename__ = "visitors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    company = Column(String)
    phone = Column(String)
    license_plate = Column(String)
    id_card = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    meetings = relationship("Meeting", back_populates="visitor")


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True)
    visitor_id = Column(Integer, ForeignKey("visitors.id"))
    host_name = Column(String)
    host_department = Column(String)
    meeting_room = Column(String)
    purpose = Column(String)
    scheduled_start = Column(DateTime)
    scheduled_end = Column(DateTime)
    actual_start = Column(DateTime, nullable=True)
    actual_end = Column(DateTime, nullable=True)
    status = Column(Enum(VisitorStatus), default=VisitorStatus.PENDING)
    approval_note = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    visitor = relationship("Visitor", back_populates="meetings")
    reservations = relationship("ParkingReservation", back_populates="meeting")


class ParkingReservation(Base):
    __tablename__ = "parking_reservations"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"))
    spot_id = Column(Integer, ForeignKey("parking_spots.id"))
    license_plate = Column(String)
    scheduled_start = Column(DateTime)
    scheduled_end = Column(DateTime)
    actual_start = Column(DateTime, nullable=True)
    actual_end = Column(DateTime, nullable=True)
    status = Column(Enum(ReservationStatus), default=ReservationStatus.PENDING)
    lock_expires_at = Column(DateTime, nullable=True)
    source_record = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    meeting = relationship("Meeting", back_populates="reservations")
    spot = relationship("ParkingSpot", back_populates="reservations")
    extensions = relationship("ReservationExtension", back_populates="reservation")


class ReservationExtension(Base):
    __tablename__ = "reservation_extensions"

    id = Column(Integer, primary_key=True, index=True)
    reservation_id = Column(Integer, ForeignKey("parking_reservations.id"))
    original_end = Column(DateTime)
    new_end = Column(DateTime)
    reason = Column(String, nullable=True)
    status = Column(Enum(ReservationStatus), default=ReservationStatus.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)

    reservation = relationship("ParkingReservation", back_populates="extensions")
