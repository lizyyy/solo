from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Enum, Boolean, JSON, Float
from sqlalchemy.orm import relationship
from .database import Base

class UserRole(PyEnum):
    ADMIN = "admin"
    MANAGER = "manager"
    CS = "cs"
    OPERATOR = "operator"

class ReissueStatus(PyEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class OperationType(PyEnum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    STATUS_CHANGE = "status_change"
    EXPORT = "export"
    IMPORT = "import"
    BATCH_OPERATION = "batch_operation"

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=True)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.CS)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    reissues_created = relationship("Reissue", back_populates="creator", foreign_keys="Reissue.created_by")
    reissues_assigned = relationship("Reissue", back_populates="assignee", foreign_keys="Reissue.assigned_to")
    operations = relationship("OperationLog", back_populates="user")

class Reissue(Base):
    __tablename__ = "reissues"
    
    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, nullable=False, index=True)
    customer_name = Column(String(100), nullable=False)
    customer_phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    product_name = Column(String(200), nullable=False)
    product_sku = Column(String(100), nullable=True)
    quantity = Column(Integer, default=1)
    reason = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    
    status = Column(Enum(ReissueStatus), nullable=False, default=ReissueStatus.PENDING)
    tracking_number = Column(String(100), nullable=True)
    shipping_company = Column(String(100), nullable=True)
    shipping_cost = Column(Float, nullable=True)
    
    remarks = Column(Text, nullable=True)
    version = Column(Integer, default=1)
    retry_count = Column(Integer, default=0)
    last_error = Column(Text, nullable=True)
    next_retry_at = Column(DateTime, nullable=True)
    
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    creator = relationship("User", back_populates="reissues_created", foreign_keys=[created_by])
    assignee = relationship("User", back_populates="reissues_assigned", foreign_keys=[assigned_to])
    status_history = relationship("StatusHistory", back_populates="reissue", order_by="StatusHistory.id")
    history = relationship("ReissueHistory", back_populates="reissue", order_by="ReissueHistory.id.desc()")
    operations = relationship("OperationLog", back_populates="reissue")

class StatusHistory(Base):
    __tablename__ = "status_history"
    
    id = Column(Integer, primary_key=True, index=True)
    reissue_id = Column(Integer, ForeignKey("reissues.id"), nullable=False, index=True)
    from_status = Column(Enum(ReissueStatus), nullable=True)
    to_status = Column(Enum(ReissueStatus), nullable=False)
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    reissue = relationship("Reissue", back_populates="status_history")

class ReissueHistory(Base):
    __tablename__ = "reissue_history"
    
    id = Column(Integer, primary_key=True, index=True)
    reissue_id = Column(Integer, ForeignKey("reissues.id"), nullable=False, index=True)
    version = Column(Integer, nullable=False)
    snapshot = Column(JSON, nullable=False)
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    change_type = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    reissue = relationship("Reissue", back_populates="history")

class OperationLog(Base):
    __tablename__ = "operation_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    reissue_id = Column(Integer, ForeignKey("reissues.id"), nullable=True, index=True)
    operation_type = Column(Enum(OperationType), nullable=False)
    detail = Column(JSON, nullable=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="operations")
    reissue = relationship("Reissue", back_populates="operations")

class FailedTask(Base):
    __tablename__ = "failed_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    task_name = Column(String(100), nullable=False, index=True)
    reissue_id = Column(Integer, ForeignKey("reissues.id"), nullable=True)
    parameters = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=False)
    error_stack = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    next_retry_at = Column(DateTime, nullable=True)
    status = Column(String(20), default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
