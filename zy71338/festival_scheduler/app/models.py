from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean,
    Enum as SAEnum,
)
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class ConflictType(str, enum.Enum):
    CHANGEOVER_OVERLAP = "changeover_overlap"
    ARTIST_LATE = "artist_late"
    NOISE_VIOLATION = "noise_violation"
    DOUBLE_BOOKED = "double_booked"


class ConflictSeverity(str, enum.Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class ConflictStatus(str, enum.Enum):
    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class ScheduleStatus(str, enum.Enum):
    DRAFT = "draft"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    RESCHEDULED = "rescheduled"


class NotificationStatus(str, enum.Enum):
    PENDING = "pending"
    SENT = "sent"
    READ = "read"
    FAILED = "failed"


class Stage(Base):
    __tablename__ = "stages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    location = Column(String(200), nullable=True)
    capacity = Column(Integer, nullable=True)
    noise_limit_db = Column(Float, nullable=False, default=95.0)
    has_noise_monitor = Column(Boolean, default=False)
    equipment_tags = Column(Text, nullable=True)
    available_from = Column(DateTime, nullable=True)
    available_to = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    schedules = relationship("Schedule", back_populates="stage")


class Artist(Base):
    __tablename__ = "artists"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    genre = Column(String(50), nullable=True)
    avg_volume_db = Column(Float, nullable=True)
    rider_equipment = Column(Text, nullable=True)
    contact_phone = Column(String(30), nullable=True)
    contact_email = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    availability_windows = relationship("ArtistAvailability", back_populates="artist")
    schedules = relationship("Schedule", back_populates="artist")


class ArtistAvailability(Base):
    __tablename__ = "artist_availability"

    id = Column(Integer, primary_key=True, index=True)
    artist_id = Column(Integer, ForeignKey("artists.id"), nullable=False)
    window_start = Column(DateTime, nullable=False)
    window_end = Column(DateTime, nullable=False)
    is_hard_constraint = Column(Boolean, default=True)
    note = Column(Text, nullable=True)

    artist = relationship("Artist", back_populates="availability_windows")


class ChangeoverRule(Base):
    __tablename__ = "changeover_rules"

    id = Column(Integer, primary_key=True, index=True)
    from_artist_id = Column(Integer, ForeignKey("artists.id"), nullable=True)
    to_artist_id = Column(Integer, ForeignKey("artists.id"), nullable=True)
    from_genre = Column(String(50), nullable=True)
    to_genre = Column(String(50), nullable=True)
    stage_id = Column(Integer, ForeignKey("stages.id"), nullable=True)
    duration_minutes = Column(Integer, nullable=False, default=30)
    equipment_swap = Column(Text, nullable=True)
    note = Column(Text, nullable=True)


class NoiseRestriction(Base):
    __tablename__ = "noise_restrictions"

    id = Column(Integer, primary_key=True, index=True)
    stage_id = Column(Integer, ForeignKey("stages.id"), nullable=True)
    area_name = Column(String(100), nullable=True)
    max_db = Column(Float, nullable=False)
    restricted_from = Column(DateTime, nullable=False)
    restricted_to = Column(DateTime, nullable=False)
    reason = Column(Text, nullable=True)
    authority = Column(String(100), nullable=True)
    is_recurring_daily = Column(Boolean, default=False)


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    artist_id = Column(Integer, ForeignKey("artists.id"), nullable=False)
    stage_id = Column(Integer, ForeignKey("stages.id"), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    status = Column(SAEnum(ScheduleStatus), default=ScheduleStatus.DRAFT)
    changeover_before_minutes = Column(Integer, default=0)
    changeover_after_minutes = Column(Integer, default=0)
    estimated_volume_db = Column(Float, nullable=True)
    assigned_by = Column(String(100), nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    artist = relationship("Artist", back_populates="schedules")
    stage = relationship("Stage", back_populates="schedules")
    history_entries = relationship("ScheduleHistory", back_populates="schedule", order_by="ScheduleHistory.changed_at.desc()")
    conflicts = relationship("Conflict", back_populates="schedule")


class ScheduleHistory(Base):
    __tablename__ = "schedule_history"

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("schedules.id"), nullable=False)
    change_type = Column(String(50), nullable=False)
    field_name = Column(String(50), nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    changed_by = Column(String(100), nullable=True)
    change_reason = Column(Text, nullable=True)
    changed_at = Column(DateTime, default=datetime.utcnow)

    schedule = relationship("Schedule", back_populates="history_entries")


class Conflict(Base):
    __tablename__ = "conflicts"

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("schedules.id"), nullable=False)
    conflict_type = Column(SAEnum(ConflictType), nullable=False)
    severity = Column(SAEnum(ConflictSeverity), default=ConflictSeverity.WARNING)
    status = Column(SAEnum(ConflictStatus), default=ConflictStatus.OPEN)
    message = Column(Text, nullable=False)
    detail = Column(Text, nullable=True)
    related_schedule_id = Column(Integer, nullable=True)
    detected_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String(100), nullable=True)
    resolution_note = Column(Text, nullable=True)

    schedule = relationship("Schedule", back_populates="conflicts")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    recipient = Column(String(200), nullable=False)
    recipient_role = Column(String(50), nullable=True)
    subject = Column(String(300), nullable=False)
    body = Column(Text, nullable=False)
    notification_type = Column(String(50), nullable=False)
    status = Column(SAEnum(NotificationStatus), default=NotificationStatus.PENDING)
    related_schedule_id = Column(Integer, nullable=True)
    related_conflict_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    sent_at = Column(DateTime, nullable=True)
    read_at = Column(DateTime, nullable=True)
