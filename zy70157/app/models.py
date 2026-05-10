"""数据模型定义"""
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, Boolean, JSON, Enum
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class TaskStatus(str, enum.Enum):
    """任务状态枚举"""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"
    RETRYING = "retrying"


class RetryRequestStatus(str, enum.Enum):
    """补跑申请状态"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXECUTING = "executing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ExceptionType(str, enum.Enum):
    """异常类型"""
    DEPENDENCY_ERROR = "dependency_error"
    REENTRANCY_VIOLATION = "reentrancy_violation"
    WINDOW_VIOLATION = "window_violation"
    DATA_BOUNDARY_ERROR = "data_boundary_error"
    EXECUTION_ERROR = "execution_error"
    UNKNOWN_ERROR = "unknown_error"


class BatchJob(Base):
    """批作业定义"""
    __tablename__ = "batch_jobs"

    id = Column(String(64), primary_key=True)
    name = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    retry_window_hours = Column(Integer, default=24)
    max_retries = Column(Integer, default=3)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    instances = relationship("TaskInstance", back_populates="job")


class TaskDependency(Base):
    """任务依赖关系"""
    __tablename__ = "task_dependencies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(String(64), ForeignKey("batch_jobs.id"), nullable=False)
    source_task = Column(String(64), nullable=False)
    target_task = Column(String(64), nullable=False)
    is_soft_dependency = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class TaskInstance(Base):
    """任务实例"""
    __tablename__ = "task_instances"

    id = Column(String(128), primary_key=True)
    job_id = Column(String(64), ForeignKey("batch_jobs.id"), nullable=False)
    task_name = Column(String(128), nullable=False)
    business_date = Column(String(32), nullable=False)
    status = Column(String(32), default=TaskStatus.PENDING.value)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    execution_duration_ms = Column(Integer, nullable=True)
    
    input_data = Column(JSON, nullable=True)
    output_data = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    
    reentrancy_key = Column(String(256), nullable=True)
    is_locked = Column(Boolean, default=False)
    lock_acquired_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    job = relationship("BatchJob", back_populates="instances")
    retry_requests = relationship("RetryRequest", back_populates="task_instance")


class RetryRequest(Base):
    """补跑申请"""
    __tablename__ = "retry_requests"

    id = Column(String(128), primary_key=True)
    task_instance_id = Column(String(128), ForeignKey("task_instances.id"), nullable=False)
    requester = Column(String(128), nullable=False)
    reason = Column(Text, nullable=False)
    retry_type = Column(String(32), default="single")
    
    target_retry_count = Column(Integer, default=1)
    skip_rules = Column(JSON, nullable=True)
    
    window_start = Column(DateTime, nullable=True)
    window_end = Column(DateTime, nullable=True)
    is_within_window = Column(Boolean, nullable=True)
    
    status = Column(String(32), default=RetryRequestStatus.PENDING.value)
    approved_by = Column(String(128), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    task_instance = relationship("TaskInstance", back_populates="retry_requests")
    executions = relationship("RetryExecution", back_populates="retry_request")


class ReentrancyLock(Base):
    """重入锁"""
    __tablename__ = "reentrancy_locks"

    lock_key = Column(String(256), primary_key=True)
    task_instance_id = Column(String(128), ForeignKey("task_instances.id"), nullable=False)
    owner_process = Column(String(128), nullable=False)
    acquired_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    is_released = Column(Boolean, default=False)
    released_at = Column(DateTime, nullable=True)


class ExecutionReport(Base):
    """执行报告"""
    __tablename__ = "execution_reports"

    id = Column(String(128), primary_key=True)
    task_instance_id = Column(String(128), ForeignKey("task_instances.id"), nullable=False)
    retry_request_id = Column(String(128), ForeignKey("retry_requests.id"), nullable=True)
    
    execution_sequence = Column(Integer, default=1)
    status = Column(String(32), default=TaskStatus.PENDING.value)
    
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    
    skip_reason = Column(Text, nullable=True)
    is_skipped = Column(Boolean, default=False)
    
    input_snapshot = Column(JSON, nullable=True)
    output_snapshot = Column(JSON, nullable=True)
    error_details = Column(JSON, nullable=True)
    
    affected_final_result = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)


class RetryExecution(Base):
    """补跑执行记录"""
    __tablename__ = "retry_executions"

    id = Column(String(128), primary_key=True)
    retry_request_id = Column(String(128), ForeignKey("retry_requests.id"), nullable=False)
    execution_report_id = Column(String(128), ForeignKey("execution_reports.id"), nullable=True)
    
    retry_number = Column(Integer, default=1)
    status = Column(String(32), default=TaskStatus.PENDING.value)
    
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    retry_request = relationship("RetryRequest", back_populates="executions")


class ExceptionRecord(Base):
    """异常记录 - 边界数据不静默吞掉"""
    __tablename__ = "exception_records"

    id = Column(String(128), primary_key=True)
    exception_type = Column(String(64), nullable=False)
    severity = Column(String(32), default="error")
    
    task_instance_id = Column(String(128), nullable=True)
    retry_request_id = Column(String(128), nullable=True)
    
    title = Column(String(256), nullable=False)
    details = Column(Text, nullable=False)
    context = Column(JSON, nullable=True)
    
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(String(128), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
