from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
import enum


class TaskStatus(str, enum.Enum):
    CREATED = "created"
    REGISTERED = "registered"
    ARCHIVED = "archived"
    EXPIRED = "expired"
    CLEANED = "cleaned"
    REVOKED = "revoked"


class ArchiveStrategy(str, enum.Enum):
    IMMEDIATE = "immediate"
    DELAYED = "delayed"
    MANUAL = "manual"


class AccessLevel(str, enum.Enum):
    READ = "read"
    WRITE = "write"
    ADMIN = "admin"


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_number = Column(String, unique=True, index=True, nullable=False)
    task_name = Column(String, index=True)
    description = Column(Text)
    status = Column(Enum(TaskStatus), default=TaskStatus.CREATED)
    archive_strategy = Column(Enum(ArchiveStrategy), default=ArchiveStrategy.DELAYED)
    
    output_file_path = Column(String)
    output_file_name = Column(String)
    output_file_size = Column(Integer)
    output_file_hash = Column(String)
    
    access_level = Column(Enum(AccessLevel), default=AccessLevel.READ)
    owner = Column(String, index=True)
    
    archive_location = Column(String)
    expire_at = Column(DateTime)
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    timelines = relationship("Timeline", back_populates="task", cascade="all, delete-orphan")
    archive_records = relationship("ArchiveRecord", back_populates="task", cascade="all, delete-orphan")
    cleanup_records = relationship("CleanupRecord", back_populates="task", cascade="all, delete-orphan")


class Timeline(Base):
    __tablename__ = "timelines"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    action = Column(String, index=True, nullable=False)
    status_before = Column(String)
    status_after = Column(String)
    operator = Column(String)
    description = Column(Text)
    details = Column(JSON)
    timestamp = Column(DateTime, server_default=func.now())
    
    task = relationship("Task", back_populates="timelines")


class ArchiveRecord(Base):
    __tablename__ = "archive_records"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    source_location = Column(String)
    target_location = Column(String)
    archive_size = Column(Integer)
    operator = Column(String)
    is_successful = Column(Boolean, default=True)
    error_message = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    
    task = relationship("Task", back_populates="archive_records")


class CleanupRecord(Base):
    __tablename__ = "cleanup_records"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    cleaned_location = Column(String)
    cleanup_reason = Column(String)
    operator = Column(String)
    is_successful = Column(Boolean, default=True)
    error_message = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    
    task = relationship("Task", back_populates="cleanup_records")
