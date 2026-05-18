from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Enum, Float
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from database import Base


class DeviceType(str, enum.Enum):
    PROJECTOR = "projector"
    WHITEBOARD = "whiteboard"
    MICROPHONE = "microphone"
    SPEAKER = "speaker"
    COMPUTER = "computer"
    AIRCON = "aircon"
    SEAT_TABLE = "seat_table"


class RoomStatus(str, enum.Enum):
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    MAINTENANCE = "maintenance"


class SwapStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    NOTIFYING = "notifying"
    ALL_CONFIRMED = "all_confirmed"
    COMPLETED = "completed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    CLOSED = "closed"


class NotificationStatus(str, enum.Enum):
    PENDING = "pending"
    SENT = "sent"
    CONFIRMED = "confirmed"
    FAILED = "failed"


class Room(Base):
    __tablename__ = "rooms"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    location = Column(String(200))
    capacity = Column(Integer, nullable=False)
    status = Column(String(50), default=RoomStatus.AVAILABLE)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    devices = relationship("RoomDevice", back_populates="room", cascade="all, delete-orphan")
    original_swaps = relationship("RoomSwap", back_populates="original_room", foreign_keys="RoomSwap.original_room_id")
    target_swaps = relationship("RoomSwap", back_populates="target_room", foreign_keys="RoomSwap.target_room_id")


class RoomDevice(Base):
    __tablename__ = "room_devices"
    
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    device_type = Column(String(50), nullable=False)
    quantity = Column(Integer, default=1)
    description = Column(String(500))
    is_working = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    room = relationship("Room", back_populates="devices")


class Course(Base):
    __tablename__ = "courses"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    instructor = Column(String(100))
    student_count = Column(Integer, nullable=False)
    scheduled_time = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, default=120)
    original_room_id = Column(Integer, ForeignKey("rooms.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    device_requirements = relationship("DeviceRequirement", back_populates="course", cascade="all, delete-orphan")
    swaps = relationship("RoomSwap", back_populates="course")
    students = relationship("Student", back_populates="course", cascade="all, delete-orphan")


class DeviceRequirement(Base):
    __tablename__ = "device_requirements"
    
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    device_type = Column(String(50), nullable=False)
    min_quantity = Column(Integer, default=1)
    required = Column(Boolean, default=True)
    notes = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    course = relationship("Course", back_populates="device_requirements")


class Student(Base):
    __tablename__ = "students"
    
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    name = Column(String(100), nullable=False)
    phone = Column(String(20))
    email = Column(String(200))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    course = relationship("Course", back_populates="students")
    notifications = relationship("Notification", back_populates="student")


class RoomSwap(Base):
    __tablename__ = "room_swaps"
    
    id = Column(Integer, primary_key=True, index=True)
    swap_code = Column(String(50), unique=True, nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    original_room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    target_room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    reason = Column(Text)
    status = Column(String(50), default=SwapStatus.DRAFT)
    check_capacity_pass = Column(Boolean)
    check_devices_pass = Column(Boolean)
    created_by = Column(String(100), nullable=False)
    handled_by = Column(String(100))
    handle_conclusion = Column(Text)
    original_input = Column(Text)
    scheduled_time = Column(DateTime, nullable=False)
    actual_time = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    course = relationship("Course", back_populates="swaps")
    original_room = relationship("Room", back_populates="original_swaps", foreign_keys=[original_room_id])
    target_room = relationship("Room", back_populates="target_swaps", foreign_keys=[target_room_id])
    notifications = relationship("Notification", back_populates="swap", cascade="all, delete-orphan")
    sign_in_code = relationship("SignInCode", back_populates="swap", uselist=False, cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="swap", cascade="all, delete-orphan")


class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    swap_id = Column(Integer, ForeignKey("room_swaps.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    content = Column(Text, nullable=False)
    status = Column(String(50), default=NotificationStatus.PENDING)
    sent_at = Column(DateTime)
    confirmed_at = Column(DateTime)
    confirmed_by = Column(String(100))
    failed_reason = Column(String(500))
    retry_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    swap = relationship("RoomSwap", back_populates="notifications")
    student = relationship("Student", back_populates="notifications")


class SignInCode(Base):
    __tablename__ = "sign_in_codes"
    
    id = Column(Integer, primary_key=True, index=True)
    swap_id = Column(Integer, ForeignKey("room_swaps.id"), nullable=False, unique=True)
    code = Column(String(50), nullable=False, unique=True)
    original_code = Column(String(50))
    new_code = Column(String(50))
    refreshed_at = Column(DateTime)
    refresh_count = Column(Integer, default=0)
    expires_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    swap = relationship("RoomSwap", back_populates="sign_in_code")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    swap_id = Column(Integer, ForeignKey("room_swaps.id"), nullable=False)
    action = Column(String(100), nullable=False)
    previous_status = Column(String(50))
    new_status = Column(String(50))
    operator = Column(String(100), nullable=False)
    original_input = Column(Text)
    conclusion = Column(Text)
    remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    swap = relationship("RoomSwap", back_populates="audit_logs")
