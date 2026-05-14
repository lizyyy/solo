from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base
import enum

class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SKIPPED = "skipped"

class ApprovalChainStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    APPROVED = "approved"
    REJECTED = "rejected"

class ApprovalChain(Base):
    __tablename__ = "approval_chains"

    id = Column(Integer, primary_key=True, index=True)
    migration_id = Column(Integer, ForeignKey("migration_scripts.id"), nullable=False, unique=True)
    status = Column(Enum(ApprovalChainStatus), default=ApprovalChainStatus.NOT_STARTED)
    current_step_index = Column(Integer, default=0)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    migration = relationship("MigrationScript", back_populates="approval_chain")
    steps = relationship("ApprovalStep", back_populates="chain", cascade="all, delete-orphan", order_by="ApprovalStep.step_order")

class ApprovalStep(Base):
    __tablename__ = "approval_steps"

    id = Column(Integer, primary_key=True, index=True)
    chain_id = Column(Integer, ForeignKey("approval_chains.id"), nullable=False)
    step_order = Column(Integer, nullable=False)
    role = Column(String(100), nullable=False)
    approver = Column(String(100))
    status = Column(Enum(ApprovalStatus), default=ApprovalStatus.PENDING)
    comment = Column(Text)
    approved_at = Column(DateTime)
    is_required = Column(Integer, default=True)
    rules = Column(Text)
    
    chain = relationship("ApprovalChain", back_populates="steps")