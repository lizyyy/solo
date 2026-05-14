from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base
import enum

class MigrationStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXECUTING = "executing"
    SUCCESS = "success"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"

class MigrationScript(Base):
    __tablename__ = "migration_scripts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), index=True, nullable=False)
    description = Column(Text)
    script_content = Column(Text, nullable=False)
    database_type = Column(String(50), default="mysql")
    status = Column(Enum(MigrationStatus), default=MigrationStatus.DRAFT)
    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    executed_at = Column(DateTime)
    version = Column(Integer, default=1)
    parent_id = Column(Integer, ForeignKey("migration_scripts.id"), nullable=True)
    
    affected_tables = relationship("AffectedTable", back_populates="migration", cascade="all, delete-orphan")
    execution_windows = relationship("ExecutionWindow", back_populates="migration", cascade="all, delete-orphan")
    rollback_scripts = relationship("RollbackScript", back_populates="migration", cascade="all, delete-orphan")
    approval_chain = relationship("ApprovalChain", back_populates="migration", uselist=False)
    execution_logs = relationship("ExecutionLog", back_populates="migration")
    versions = relationship("MigrationScript", remote_side=[id])

class AffectedTable(Base):
    __tablename__ = "affected_tables"

    id = Column(Integer, primary_key=True, index=True)
    migration_id = Column(Integer, ForeignKey("migration_scripts.id"), nullable=False)
    table_name = Column(String(200), nullable=False)
    operation_type = Column(String(50))
    estimated_rows = Column(Integer, default=0)
    actual_rows = Column(Integer)
    has_backup = Column(Boolean, default=False)
    remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    migration = relationship("MigrationScript", back_populates="affected_tables")

class ExecutionWindow(Base):
    __tablename__ = "execution_windows"

    id = Column(Integer, primary_key=True, index=True)
    migration_id = Column(Integer, ForeignKey("migration_scripts.id"), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    timezone = Column(String(50), default="Asia/Shanghai")
    is_enabled = Column(Boolean, default=True)
    remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    migration = relationship("MigrationScript", back_populates="execution_windows")

class RollbackScript(Base):
    __tablename__ = "rollback_scripts"

    id = Column(Integer, primary_key=True, index=True)
    migration_id = Column(Integer, ForeignKey("migration_scripts.id"), nullable=False)
    script_content = Column(Text, nullable=False)
    version = Column(Integer, default=1)
    is_valid = Column(Boolean, default=True)
    validation_result = Column(Text)
    validated_at = Column(DateTime)
    validated_by = Column(String(100))
    remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    migration = relationship("MigrationScript", back_populates="rollback_scripts")