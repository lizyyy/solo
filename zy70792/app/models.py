import enum
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    SCANNING = "scanning"
    SCAN_COMPLETED = "scan_completed"
    COMPARING = "comparing"
    COMPARISON_COMPLETED = "comparison_completed"
    CONFLICT = "conflict"
    RESOLVED = "resolved"
    CANCELLED = "cancelled"
    CLOSED = "closed"


class ArtifactFile(Base):
    __tablename__ = "artifact_files"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("hash_tasks.id"))
    file_path = Column(String, index=True)
    file_name = Column(String, index=True)
    file_size = Column(Integer)
    file_hash = Column(String, index=True)
    upload_region = Column(String, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    task = relationship("HashTask", back_populates="files")


class HashTask(Base):
    __tablename__ = "hash_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_name = Column(String, index=True)
    artifact_dir = Column(String)
    regions = Column(String)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING)
    report = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    files = relationship("ArtifactFile", back_populates="task")
    exceptions = relationship("ExceptionRecord", back_populates="task")


class ExceptionRecord(Base):
    __tablename__ = "exception_records"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("hash_tasks.id"))
    original_input = Column(Text)
    handler = Column(String)
    conclusion = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    task = relationship("HashTask", back_populates="exceptions")
