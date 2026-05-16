from sqlalchemy import Column, String, Integer, BigInteger, Text, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class StreamTask(Base):
    __tablename__ = "stream_tasks"

    id = Column(String(64), primary_key=True, index=True)
    task_name = Column(String(256), nullable=False)
    status = Column(String(32), default="pending", index=True)
    total_shards = Column(Integer, default=1)
    current_watermark = Column(BigInteger, default=0)
    target_watermark = Column(BigInteger, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    task_metadata = Column(JSON, default=dict)

    shards = relationship("TaskShard", back_populates="task", cascade="all, delete-orphan")
    failures = relationship("FailureRecord", back_populates="task", cascade="all, delete-orphan")
    reports = relationship("ResumeReport", back_populates="task", cascade="all, delete-orphan")


class TaskShard(Base):
    __tablename__ = "task_shards"

    id = Column(String(128), primary_key=True)
    task_id = Column(String(64), ForeignKey("stream_tasks.id"), nullable=False)
    shard_no = Column(Integer, nullable=False)
    status = Column(String(32), default="pending", index=True)
    start_offset = Column(BigInteger, default=0)
    end_offset = Column(BigInteger, default=0)
    current_offset = Column(BigInteger, default=0)
    processed_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    checksum = Column(String(64), nullable=True)

    task = relationship("StreamTask", back_populates="shards")

    __mapper_args__ = {
        "primary_key": ["task_id", "shard_no"]
    }


class FailureRecord(Base):
    __tablename__ = "failure_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(String(64), ForeignKey("stream_tasks.id"), nullable=False)
    shard_no = Column(Integer, nullable=False)
    offset = Column(BigInteger, nullable=False)
    raw_input = Column(Text, nullable=False)
    process_context = Column(Text, nullable=True)
    error_message = Column(Text, nullable=False)
    error_stack = Column(Text, nullable=True)
    final_status = Column(String(32), default="failed")
    is_manually_fixed = Column(Boolean, default=False)
    fix_note = Column(Text, nullable=True)
    fixed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("StreamTask", back_populates="failures")


class ResumeReport(Base):
    __tablename__ = "resume_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(String(64), ForeignKey("stream_tasks.id"), nullable=False)
    resume_no = Column(Integer, default=1)
    start_watermark = Column(BigInteger, nullable=False)
    end_watermark = Column(BigInteger, nullable=False)
    total_processed = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    already_synced = Column(JSON, default=list)
    resume_reason = Column(String(256), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("StreamTask", back_populates="reports")
