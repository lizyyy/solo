from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./budget_allocator.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class ApprovalOrder(Base):
    __tablename__ = "approval_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, index=True, nullable=False)
    department = Column(String(100), nullable=False)
    applicant = Column(String(50), nullable=False)
    amount = Column(Float, nullable=False)
    subject = Column(String(200), nullable=False)
    apply_date = Column(DateTime, nullable=False)
    due_date = Column(DateTime, nullable=False)
    status = Column(String(20), default="pending")
    priority = Column(String(20), default="normal")
    material_summary = Column(Text)
    current_approver = Column(String(50))
    overdue_days = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    allocations = relationship("BudgetAllocation", back_populates="order")
    corrections = relationship("ManualCorrection", back_populates="order")
    process_logs = relationship("ProcessLog", back_populates="order")


class BudgetAllocation(Base):
    __tablename__ = "budget_allocations"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("approval_orders.id"), nullable=False)
    allocated_amount = Column(Float, nullable=False)
    allocated_budget_code = Column(String(50))
    allocation_reason = Column(Text)
    algorithm_version = Column(String(50), nullable=False)
    is_overridden = Column(Boolean, default=False)
    status = Column(String(20), default="success")
    error_message = Column(Text)
    execution_time_ms = Column(Integer)
    created_at = Column(DateTime, default=datetime.now)

    order = relationship("ApprovalOrder", back_populates="allocations")
    version_freeze = relationship("VersionFreeze", back_populates="allocation", uselist=False)


class VersionFreeze(Base):
    __tablename__ = "version_freezes"

    id = Column(Integer, primary_key=True, index=True)
    allocation_id = Column(Integer, ForeignKey("budget_allocations.id"), nullable=False)
    freeze_note = Column(String(200), nullable=False)
    frozen_by = Column(String(50))
    frozen_at = Column(DateTime, default=datetime.now)
    algorithm_hash = Column(String(64))

    allocation = relationship("BudgetAllocation", back_populates="version_freeze")


class ManualCorrection(Base):
    __tablename__ = "manual_corrections"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("approval_orders.id"), nullable=False)
    original_allocation_id = Column(Integer, ForeignKey("budget_allocations.id"))
    corrected_amount = Column(Float)
    corrected_budget_code = Column(String(50))
    correction_reason = Column(Text, nullable=False)
    corrected_by = Column(String(50), nullable=False)
    system_judgment_snapshot = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.now)

    order = relationship("ApprovalOrder", back_populates="corrections")


class ProcessLog(Base):
    __tablename__ = "process_logs"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("approval_orders.id"))
    operation_type = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False)
    detail = Column(Text)
    execution_time_ms = Column(Integer)
    operator = Column(String(50))
    created_at = Column(DateTime, default=datetime.now, index=True)

    order = relationship("ApprovalOrder", back_populates="process_logs")

    __table_args__ = (
        Index("idx_log_order_created", "order_id", "created_at"),
    )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
