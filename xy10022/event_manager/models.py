from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean, JSON
from sqlalchemy.orm import relationship
import enum

from .database import Base

class UserRole(str, enum.Enum):
    ADMIN = 'admin'
    ORGANIZER = 'organizer'
    VOLUNTEER = 'volunteer'

class EventStatus(str, enum.Enum):
    DRAFT = 'draft'
    PUBLISHED = 'published'
    ONGOING = 'ongoing'
    COMPLETED = 'completed'
    CANCELLED = 'cancelled'

class RegistrationStatus(str, enum.Enum):
    PENDING = 'pending'
    CONFIRMED = 'confirmed'
    CANCELLED = 'cancelled'
    COMPLETED = 'completed'
    NO_SHOW = 'no_show'

class LogLevel(str, enum.Enum):
    DEBUG = 'debug'
    INFO = 'info'
    WARNING = 'warning'
    ERROR = 'error'

class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    email = Column(String(100), unique=True, nullable=True)
    full_name = Column(String(100), nullable=True)
    role = Column(Enum(UserRole), default=UserRole.VOLUNTEER, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    created_events = relationship('Event', back_populates='created_by_user')
    registrations = relationship('Registration', back_populates='user')
    actions = relationship('AuditLog', back_populates='user')

class Event(Base):
    __tablename__ = 'events'

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    location = Column(String(200), nullable=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=True)
    max_participants = Column(Integer, nullable=True)
    status = Column(Enum(EventStatus), default=EventStatus.DRAFT, nullable=False)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    created_by_user = relationship('User', back_populates='created_events')
    registrations = relationship('Registration', back_populates='event', cascade='all, delete-orphan')
    versions = relationship('EventVersion', back_populates='event', cascade='all, delete-orphan')

class EventVersion(Base):
    __tablename__ = 'event_versions'

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey('events.id'), nullable=False)
    version_number = Column(Integer, nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    location = Column(String(200), nullable=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=True)
    max_participants = Column(Integer, nullable=True)
    status = Column(Enum(EventStatus), nullable=False)
    changed_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    change_reason = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    event = relationship('Event', back_populates='versions')

class Registration(Base):
    __tablename__ = 'registrations'

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey('events.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    participant_name = Column(String(100), nullable=False)
    participant_email = Column(String(100), nullable=True)
    participant_phone = Column(String(20), nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(Enum(RegistrationStatus), default=RegistrationStatus.PENDING, nullable=False)
    extra_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    event = relationship('Event', back_populates='registrations')
    user = relationship('User', back_populates='registrations')
    versions = relationship('RegistrationVersion', back_populates='registration', cascade='all, delete-orphan')

class RegistrationVersion(Base):
    __tablename__ = 'registration_versions'

    id = Column(Integer, primary_key=True, index=True)
    registration_id = Column(Integer, ForeignKey('registrations.id'), nullable=False)
    version_number = Column(Integer, nullable=False)
    participant_name = Column(String(100), nullable=False)
    participant_email = Column(String(100), nullable=True)
    participant_phone = Column(String(20), nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(Enum(RegistrationStatus), nullable=False)
    extra_data = Column(JSON, nullable=True)
    changed_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    change_reason = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    registration = relationship('Registration', back_populates='versions')

class AuditLog(Base):
    __tablename__ = 'audit_logs'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(Integer, nullable=True)
    details = Column(JSON, nullable=True)
    level = Column(Enum(LogLevel), default=LogLevel.INFO, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship('User', back_populates='actions')

class FailedOperation(Base):
    __tablename__ = 'failed_operations'

    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String(100), nullable=False)
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(Integer, nullable=True)
    input_data = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=False)
    retry_count = Column(Integer, default=0)
    last_retry_at = Column(DateTime, nullable=True)
    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
