from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship

from app.db.database import Base


class WarmupTask(Base):
    __tablename__ = "warmup_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    data_source_type = Column(String(50), nullable=False)
    data_source_config = Column(Text, nullable=False)
    cache_key_pattern = Column(String(500), nullable=False)
    version_strategy = Column(String(50), default="timestamp")
    default_concurrency = Column(Integer, default=10)
    default_qps_limit = Column(Integer, default=50)
    ttl_seconds = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    executions = relationship("TaskExecution", back_populates="task", cascade="all, delete-orphan")


class DataVersion(Base):
    __tablename__ = "data_versions"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String(100), nullable=False, index=True)
    task_id = Column(Integer, ForeignKey("warmup_tasks.id"), nullable=False, index=True)
    data_checksum = Column(String(64), nullable=False)
    data_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index('idx_task_version', 'task_id', 'version', unique=True),
    )


class TaskExecution(Base):
    __tablename__ = "task_executions"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("warmup_tasks.id"), nullable=False, index=True)
    version = Column(String(100), nullable=False, index=True)
    status = Column(String(50), default="pending", index=True)
    concurrency = Column(Integer, default=10)
    qps_limit = Column(Integer, default=50)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    total_items = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    skipped_count = Column(Integer, default=0)
    hit_rate = Column(Float, default=0.0)
    error_message = Column(Text, nullable=True)

    task = relationship("WarmupTask", back_populates="executions")
    items = relationship("ExecutionItem", back_populates="execution", cascade="all, delete-orphan")
    history = relationship("ExecutionHistory", back_populates="execution", cascade="all, delete-orphan")


class ExecutionItem(Base):
    __tablename__ = "execution_items"

    id = Column(Integer, primary_key=True, index=True)
    execution_id = Column(Integer, ForeignKey("task_executions.id"), nullable=False, index=True)
    cache_key = Column(String(500), nullable=False, index=True)
    status = Column(String(50), default="pending", index=True)
    data_version = Column(String(100), nullable=True)
    old_value_hash = Column(String(64), nullable=True)
    new_value_hash = Column(String(64), nullable=True)
    hit_expected = Column(Boolean, default=False)
    hit_actual = Column(Boolean, nullable=True)
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    execution = relationship("TaskExecution", back_populates="items")

    __table_args__ = (
        Index('idx_execution_key', 'execution_id', 'cache_key', unique=True),
    )


class ExecutionHistory(Base):
    __tablename__ = "execution_history"

    id = Column(Integer, primary_key=True, index=True)
    execution_id = Column(Integer, ForeignKey("task_executions.id"), nullable=False, index=True)
    action_type = Column(String(50), nullable=False, index=True)
    action_details = Column(Text, nullable=False)
    operator = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    execution = relationship("TaskExecution", back_populates="history")
