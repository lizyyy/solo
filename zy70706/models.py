from sqlalchemy import Column, String, Integer, DateTime, Text, Float, Boolean, Index
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()


class PipelineTask(Base):
    __tablename__ = "pipeline_tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pipeline_name = Column(String(255), nullable=False, index=True)
    shard_start = Column(Integer, nullable=False)
    shard_end = Column(Integer, nullable=False)
    watermark = Column(Integer, nullable=False)
    status = Column(String(50), nullable=False, index=True)
    fail_reason = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    max_retry = Column(Integer, default=3)
    need_manual_review = Column(Boolean, default=False)
    review_comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index('idx_pipeline_shard_status', 'pipeline_name', 'shard_start', 'shard_end', 'status'),
    )


class WriteSummary(Base):
    __tablename__ = "write_summaries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(Integer, nullable=False, index=True)
    pipeline_name = Column(String(255), nullable=False, index=True)
    shard_start = Column(Integer, nullable=False)
    shard_end = Column(Integer, nullable=False)
    write_count = Column(Integer, default=0)
    update_count = Column(Integer, default=0)
    skip_count = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    data_size_bytes = Column(Float, default=0)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    duration_seconds = Column(Float, default=0)
    export_status = Column(String(50), default="pending")
    exported_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ResumeCommand(Base):
    __tablename__ = "resume_commands"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pipeline_name = Column(String(255), nullable=False, index=True)
    target_watermark = Column(Integer, nullable=False)
    force = Column(Boolean, default=False)
    skip_shards = Column(Text, nullable=True)
    command_status = Column(String(50), default="pending")
    executed_at = Column(DateTime, nullable=True)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
