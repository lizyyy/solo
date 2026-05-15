from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class UploadStatus(str, enum.Enum):
    PENDING = "pending"
    INITIALIZED = "initialized"
    UPLOADING = "uploading"
    VERIFYING = "verifying"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"


class ChunkStatus(str, enum.Enum):
    PENDING = "pending"
    UPLOADING = "uploading"
    UPLOADED = "uploaded"
    VERIFIED = "verified"
    FAILED = "failed"
    RETRYING = "retrying"


class UploadTask(Base):
    __tablename__ = "upload_tasks"

    id = Column(String, primary_key=True, index=True)
    file_name = Column(String, index=True)
    file_size = Column(Integer)
    total_chunks = Column(Integer)
    chunk_size = Column(Integer)
    file_hash = Column(String, index=True)
    status = Column(String, default=UploadStatus.PENDING)
    resume_point = Column(Integer, default=0)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    callback_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)

    chunks = relationship("FileChunk", back_populates="task", cascade="all, delete-orphan")
    history = relationship("StatusHistory", back_populates="task", cascade="all, delete-orphan")


class FileChunk(Base):
    __tablename__ = "file_chunks"

    id = Column(String, primary_key=True, index=True)
    task_id = Column(String, ForeignKey("upload_tasks.id"))
    chunk_number = Column(Integer)
    chunk_size = Column(Integer)
    chunk_hash = Column(String)
    status = Column(String, default=ChunkStatus.PENDING)
    retry_count = Column(Integer, default=0)
    uploaded_at = Column(DateTime(timezone=True), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)

    task = relationship("UploadTask", back_populates="chunks")


class StatusHistory(Base):
    __tablename__ = "status_history"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String, ForeignKey("upload_tasks.id"))
    previous_status = Column(String)
    new_status = Column(String)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())
    changed_by = Column(String, default="system")
    note = Column(Text, nullable=True)

    task = relationship("UploadTask", back_populates="history")
