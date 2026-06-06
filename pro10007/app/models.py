from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(String, unique=True, index=True)
    customer_name = Column(String, index=True)
    id_card = Column(String, index=True)
    phone = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    data_quality_notes = Column(Text)

    accounts = relationship("LoanAccount", back_populates="customer")


class LoanAccount(Base):
    __tablename__ = "loan_accounts"

    id = Column(Integer, primary_key=True, index=True)
    account_no = Column(String, unique=True, index=True)
    customer_id = Column(String, ForeignKey("customers.customer_id"))
    loan_amount = Column(Float)
    outstanding_principal = Column(Float)
    interest_rate = Column(Float)
    loan_start_date = Column(Date)
    loan_due_date = Column(Date)
    actual_repayment_date = Column(Date)
    status = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    data_quality_notes = Column(Text)
    raw_data = Column(Text)

    customer = relationship("Customer", back_populates="accounts")
    repayments = relationship("RepaymentRecord", back_populates="account")
    warnings = relationship("WarningRecord", back_populates="account")


class RepaymentRecord(Base):
    __tablename__ = "repayment_records"

    id = Column(Integer, primary_key=True, index=True)
    account_no = Column(String, ForeignKey("loan_accounts.account_no"))
    repayment_date = Column(Date)
    repayment_amount = Column(Float)
    repayment_type = Column(String)
    clearing_date = Column(Date)
    is_refund = Column(Boolean, default=False)
    source_material = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    data_quality_notes = Column(Text)

    account = relationship("LoanAccount", back_populates="repayments")


class WarningRecord(Base):
    __tablename__ = "warning_records"

    id = Column(Integer, primary_key=True, index=True)
    account_no = Column(String, ForeignKey("loan_accounts.account_no"))
    customer_id = Column(String, index=True)
    warning_type = Column(String)
    warning_level = Column(String)
    warning_message = Column(Text)
    related_materials = Column(Text)
    is_extended = Column(Boolean, default=False)
    extension_days = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)

    account = relationship("LoanAccount", back_populates="warnings")
    review = relationship("ReviewRecord", back_populates="warning", uselist=False)


class ReviewRecord(Base):
    __tablename__ = "review_records"

    id = Column(Integer, primary_key=True, index=True)
    warning_id = Column(Integer, ForeignKey("warning_records.id"))
    reviewer = Column(String)
    review_result = Column(String)
    review_comments = Column(Text)
    exception_explanation = Column(Text)
    reviewed_at = Column(DateTime, default=datetime.utcnow)
    is_exported = Column(Boolean, default=False)

    warning = relationship("WarningRecord", back_populates="review")


class DataImportLog(Base):
    __tablename__ = "data_import_logs"

    id = Column(Integer, primary_key=True, index=True)
    file_name = Column(String)
    import_time = Column(DateTime, default=datetime.utcnow)
    total_records = Column(Integer)
    valid_records = Column(Integer)
    invalid_records = Column(Integer)
    cleaning_notes = Column(Text)
