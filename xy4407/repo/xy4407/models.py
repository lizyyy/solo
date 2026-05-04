from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Text, Date, Time
from sqlalchemy.orm import relationship
from database import Base
import enum


class AuditoriumStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    MAINTENANCE = "maintenance"


class KDMSource(str, enum.Enum):
    UPLOADED = "uploaded"
    MANUAL = "manual"


class ScheduleStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    RUNNING = "running"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    REASSIGNED = "reassigned"


class EventType(str, enum.Enum):
    KEY_EXPIRING = "key_expiring"
    KEY_EXPIRED = "key_expired"
    SERVER_MISMATCH = "server_mismatch"
    TIME_CONFLICT = "time_conflict"
    NOT_READY = "not_ready"
    DCP_MISSING = "dcp_missing"
    KDM_MISSING = "kdm_missing"


class EventPriority(str, enum.Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class EventStatus(str, enum.Enum):
    PENDING = "pending"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"


class Auditorium(Base):
    __tablename__ = "auditoriums"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True)
    server_id = Column(String(100), unique=True, index=True)
    serial_number = Column(String(100))
    location = Column(String(200))
    status = Column(String(20), default=AuditoriumStatus.ACTIVE)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    schedules = relationship("Schedule", back_populates="auditorium", foreign_keys="Schedule.auditorium_id")
    events = relationship("Event", back_populates="auditorium")


class Film(Base):
    __tablename__ = "films"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), index=True)
    cpl_id = Column(String(100), unique=True, index=True)
    duration = Column(Integer)
    language = Column(String(50))
    version = Column(String(50))
    imported_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    kdms = relationship("KDM", back_populates="film")
    schedules = relationship("Schedule", back_populates="film")
    events = relationship("Event", back_populates="film")


class KDM(Base):
    __tablename__ = "kdms"

    id = Column(Integer, primary_key=True, index=True)
    film_id = Column(Integer, ForeignKey("films.id"))
    auditorium_id = Column(Integer, ForeignKey("auditoriums.id"), nullable=True)
    cpl_id = Column(String(100), index=True)
    valid_from = Column(DateTime)
    valid_to = Column(DateTime)
    source = Column(String(20), default=KDMSource.MANUAL)
    imported_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    film = relationship("Film", back_populates="kdms")
    auditorium = relationship("Auditorium")


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    film_id = Column(Integer, ForeignKey("films.id"))
    auditorium_id = Column(Integer, ForeignKey("auditoriums.id"))
    show_date = Column(Date, index=True)
    start_time = Column(Time)
    end_time = Column(Time)
    status = Column(String(20), default=ScheduleStatus.SCHEDULED)
    original_auditorium_id = Column(Integer, ForeignKey("auditoriums.id"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    film = relationship("Film", back_populates="schedules")
    auditorium = relationship("Auditorium", back_populates="schedules", foreign_keys=[auditorium_id])
    original_auditorium = relationship("Auditorium", foreign_keys=[original_auditorium_id])
    events = relationship("Event", back_populates="schedule")


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(50))
    priority = Column(String(20), default=EventPriority.MEDIUM)
    status = Column(String(20), default=EventStatus.PENDING)
    
    film_id = Column(Integer, ForeignKey("films.id"), nullable=True)
    auditorium_id = Column(Integer, ForeignKey("auditoriums.id"), nullable=True)
    schedule_id = Column(Integer, ForeignKey("schedules.id"), nullable=True)
    kdm_id = Column(Integer, ForeignKey("kdms.id"), nullable=True)
    
    title = Column(String(200))
    description = Column(Text)
    detected_at = Column(DateTime, default=datetime.utcnow)
    
    acknowledged_by = Column(String(100), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_by = Column(String(100), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    film = relationship("Film", back_populates="events")
    auditorium = relationship("Auditorium", back_populates="events")
    schedule = relationship("Schedule", back_populates="events")
