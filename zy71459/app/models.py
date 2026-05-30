from datetime import datetime, date
from enum import Enum
from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey, Text, Boolean, Float
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.dialects.sqlite import JSON

Base = declarative_base()


class PriorityLevel(Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    EXAM = "exam"


class BookingStatus(Enum):
    PENDING = "pending"
    SCHEDULED = "scheduled"
    CONFLICT = "conflict"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class ConflictType(Enum):
    EQUIPMENT = "equipment"
    CAPACITY = "capacity"
    TIME_OVERLAP = "time_overlap"
    EXAM_WEEK = "exam_week"


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    capacity = Column(Integer, nullable=False)
    location = Column(String(200))
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    equipment = relationship("RoomEquipment", back_populates="room", cascade="all, delete-orphan")
    schedules = relationship("Schedule", back_populates="room")


class Equipment(Base):
    __tablename__ = "equipment"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    category = Column(String(50))
    total_quantity = Column(Integer, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    room_equipment = relationship("RoomEquipment", back_populates="equipment")
    booking_equipment = relationship("BookingEquipment", back_populates="equipment")


class RoomEquipment(Base):
    __tablename__ = "room_equipment"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    source_note = Column(String(200))

    room = relationship("Room", back_populates="equipment")
    equipment = relationship("Equipment", back_populates="room_equipment")


class Band(Base):
    __tablename__ = "bands"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    member_count = Column(Integer, nullable=False)
    contact_person = Column(String(100))
    contact_phone = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

    bookings = relationship("BookingRequest", back_populates="band")


class BookingRequest(Base):
    __tablename__ = "booking_requests"

    id = Column(Integer, primary_key=True, index=True)
    band_id = Column(Integer, ForeignKey("bands.id"), nullable=False)
    title = Column(String(200), nullable=False)
    purpose = Column(Text)
    preferred_date = Column(Date, nullable=False)
    start_time = Column(String(10), nullable=False)
    end_time = Column(String(10), nullable=False)
    duration_hours = Column(Float, nullable=False)
    participant_count = Column(Integer, nullable=False)
    priority = Column(String(20), default=PriorityLevel.NORMAL.value)
    status = Column(String(20), default=BookingStatus.PENDING.value)
    submitted_by = Column(String(100))
    submitted_at = Column(DateTime, default=datetime.utcnow)
    batch_id = Column(String(50))
    review_notes = Column(Text)
    reviewed_by = Column(String(100))
    reviewed_at = Column(DateTime)

    band = relationship("Band", back_populates="bookings")
    equipment = relationship("BookingEquipment", back_populates="booking", cascade="all, delete-orphan")
    schedules = relationship("Schedule", back_populates="booking")
    conflicts = relationship("ConflictRecord", back_populates="booking", foreign_keys="ConflictRecord.booking_id")


class BookingEquipment(Base):
    __tablename__ = "booking_equipment"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("booking_requests.id"), nullable=False)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    source_note = Column(String(200))

    booking = relationship("BookingRequest", back_populates="equipment")
    equipment = relationship("Equipment", back_populates="booking_equipment")


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("booking_requests.id"), nullable=False)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    scheduled_date = Column(Date, nullable=False)
    start_time = Column(String(10), nullable=False)
    end_time = Column(String(10), nullable=False)
    batch_id = Column(String(50), nullable=False)
    is_final = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    source_note = Column(String(200))

    booking = relationship("BookingRequest", back_populates="schedules")
    room = relationship("Room", back_populates="schedules")


class ConflictRecord(Base):
    __tablename__ = "conflict_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(50), nullable=False)
    booking_id = Column(Integer, ForeignKey("booking_requests.id"), nullable=False)
    conflicting_booking_id = Column(Integer, ForeignKey("booking_requests.id"))
    conflict_type = Column(String(30), nullable=False)
    conflict_details = Column(JSON, nullable=False)
    severity = Column(String(20), default="warning")
    resolved = Column(Boolean, default=False)
    resolution_note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    booking = relationship("BookingRequest", back_populates="conflicts", foreign_keys=[booking_id])


class ExamWeek(Base):
    __tablename__ = "exam_weeks"

    id = Column(Integer, primary_key=True, index=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    semester = Column(String(50))
    description = Column(String(200))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class BatchReport(Base):
    __tablename__ = "batch_reports"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(50), unique=True, nullable=False)
    batch_name = Column(String(200), nullable=False)
    scheduled_date = Column(Date, nullable=False)
    total_requests = Column(Integer, default=0)
    scheduled_count = Column(Integer, default=0)
    conflict_count = Column(Integer, default=0)
    rejected_count = Column(Integer, default=0)
    algorithm_summary = Column(JSON)
    file_path = Column(String(500))
    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
