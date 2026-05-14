from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base
import enum

class ExecutionType(str, enum.Enum):
    MIGRATION = "migration"
    ROLLBACK = "rollback"
    REPLAY = "replay"
    MANUAL_FIX = "manual_fix"

class ExecutionStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"

class ExecutionLog(Base):
    __tablename__ = "execution_logs"

    id = Column(Integer, primary_key=True, index=True)
    migration_id = Column(Integer, ForeignKey("migration_scripts.id"), nullable=False)
    execution_type = Column(Enum(ExecutionType), nullable=False)
    status = Column(Enum(ExecutionStatus), default=ExecutionStatus.PENDING)
    executed_by = Column(String(100))
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    script_content = Column(Text)
    output = Column(Text)
    error_message = Column(Text)
    affected_rows = Column(Integer)
    duration_seconds = Column(Integer)
    parent_log_id = Column(Integer, ForeignKey("execution_logs.id"), nullable=True)
    remarks = Column(Text)
    
    migration = relationship("MigrationScript", back_populates="execution_logs")
    replay_logs = relationship("ExecutionLog", remote_side=[id])