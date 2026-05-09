from datetime import datetime, date
from typing import Optional, List
from enum import Enum
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, DateTime, Date, Text,
    ForeignKey, Boolean, Index
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker

Base = declarative_base()


class LoanStatus(str, Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    PARTIAL_SETTLED = "partial_settled"
    FULL_SETTLED = "full_settled"
    OVERDUE = "overdue"


class OffsetStatus(str, Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"


class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)
    initial_balance = Column(Float, default=0.0)
    current_balance = Column(Float, default=0.0)
    frozen_amount = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    employees = relationship("Employee", back_populates="department")

    def available_balance(self):
        return self.current_balance - self.frozen_amount


class Employee(Base):
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    employee_no = Column(String(50), unique=True, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    department = relationship("Department", back_populates="employees")
    loans = relationship("Loan", back_populates="employee")


class Loan(Base):
    __tablename__ = "loans"
    id = Column(Integer, primary_key=True)
    loan_no = Column(String(50), unique=True, nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    department_id = Column(Integer, ForeignKey("departments.id"))
    amount = Column(Float, nullable=False)
    purpose = Column(Text, nullable=False)
    expected_return_date = Column(Date, nullable=False)
    status = Column(String(30), default=LoanStatus.DRAFT.value)
    actual_settled_amount = Column(Float, default=0.0)
    remaining_amount = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    employee = relationship("Employee", back_populates="loans")
    offsets = relationship("OffsetVoucher", back_populates="loan")
    approval_history = relationship("ApprovalHistory", back_populates="loan")
    overdue_reminders = relationship("OverdueReminder", back_populates="loan")

    __table_args__ = (
        Index("idx_loan_status", "status"),
        Index("idx_loan_department", "department_id"),
        Index("idx_loan_expected_date", "expected_return_date"),
    )


class OffsetVoucher(Base):
    __tablename__ = "offset_vouchers"
    id = Column(Integer, primary_key=True)
    voucher_no = Column(String(50), unique=True, nullable=False)
    loan_id = Column(Integer, ForeignKey("loans.id"))
    employee_id = Column(Integer, ForeignKey("employees.id"))
    department_id = Column(Integer, ForeignKey("departments.id"))
    offset_amount = Column(Float, nullable=False)
    cash_return_amount = Column(Float, default=0.0)
    expense_amount = Column(Float, default=0.0)
    description = Column(Text)
    status = Column(String(30), default=OffsetStatus.DRAFT.value)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    loan = relationship("Loan", back_populates="offsets")
    approval_history = relationship("ApprovalHistory", back_populates="offset")


class ApprovalHistory(Base):
    __tablename__ = "approval_history"
    id = Column(Integer, primary_key=True)
    loan_id = Column(Integer, ForeignKey("loans.id"), nullable=True)
    offset_id = Column(Integer, ForeignKey("offset_vouchers.id"), nullable=True)
    approver_name = Column(String(100), nullable=False)
    action = Column(String(50), nullable=False)
    comment = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    loan = relationship("Loan", back_populates="approval_history")
    offset = relationship("OffsetVoucher", back_populates="approval_history")


class OverdueReminder(Base):
    __tablename__ = "overdue_reminders"
    id = Column(Integer, primary_key=True)
    loan_id = Column(Integer, ForeignKey("loans.id"))
    reminder_date = Column(Date, default=date.today)
    reminder_content = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    loan = relationship("Loan", back_populates="overdue_reminders")


class ExceptionRecord(Base):
    __tablename__ = "exception_records"
    id = Column(Integer, primary_key=True)
    source_type = Column(String(50), nullable=False)
    source_id = Column(Integer, nullable=True)
    error_code = Column(String(50), nullable=False)
    error_message = Column(Text, nullable=False)
    data_snapshot = Column(Text)
    is_resolved = Column(Boolean, default=False)
    resolution_note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)


class PendingTask(Base):
    __tablename__ = "pending_tasks"
    id = Column(Integer, primary_key=True)
    task_type = Column(String(50), nullable=False)
    related_id = Column(Integer, nullable=True)
    description = Column(Text, nullable=False)
    priority = Column(String(20), default="normal")
    is_completed = Column(Boolean, default=False)
    assigned_to = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


DATABASE_URL = "sqlite:///petty_cash.db"
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    Base.metadata.create_all(bind=engine)
