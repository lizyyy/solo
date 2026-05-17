from sqlalchemy import Column, String, Integer, DateTime, Text, Enum, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum

from database import Base


class TaskStatus(str, enum.Enum):
    QUEUED = "排队中"
    GENERATING = "生成中"
    RETRYING = "重试中"
    DELIVERED = "已交付"
    FAILED = "失败"


class OperationSource(str, enum.Enum):
    USER = "用户操作"
    SYSTEM = "系统触发"
    ADMIN = "管理员操作"
    RETRY_JOB = "重试任务"


class ReportExportTask(Base):
    __tablename__ = "report_export_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_no = Column(String(64), unique=True, index=True, nullable=False)
    tenant_id = Column(String(64), index=True, nullable=False)
    report_type = Column(String(64), nullable=False)
    filter_conditions = Column(Text, nullable=False)
    file_size = Column(Integer, nullable=True)
    file_url = Column(String(512), nullable=True)
    status = Column(Enum(TaskStatus), default=TaskStatus.QUEUED, nullable=False)
    retry_count = Column(Integer, default=0, nullable=False)
    max_retries = Column(Integer, default=3, nullable=False)
    created_by = Column(String(128), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    error_message = Column(Text, nullable=True)

    history_records = relationship("TaskHistory", back_populates="task", cascade="all, delete-orphan")


class TaskHistory(Base):
    __tablename__ = "task_history"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("report_export_tasks.id"), nullable=False)
    status = Column(Enum(TaskStatus), nullable=False)
    operation_source = Column(Enum(OperationSource), nullable=False)
    operator = Column(String(128), nullable=False)
    change_reason = Column(String(512), nullable=True)
    file_size = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    task = relationship("ReportExportTask", back_populates="history_records")
