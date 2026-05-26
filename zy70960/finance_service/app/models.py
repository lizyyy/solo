from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(50), unique=True, index=True, nullable=False)
    store_code = Column(String(20), index=True, nullable=False)
    batch_type = Column(String(20), nullable=False)  # deposit, sales, petty_cash
    source_file = Column(String(255))
    record_count = Column(Integer, default=0)
    status = Column(String(20), default="pending")  # pending, processing, completed, returned
    created_by = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    remarks = Column(Text)

    deposit_records = relationship("DepositRecord", back_populates="batch", cascade="all, delete-orphan")
    sales_records = relationship("SalesRecord", back_populates="batch", cascade="all, delete-orphan")
    petty_cash_records = relationship("PettyCashRecord", back_populates="batch", cascade="all, delete-orphan")
    process_logs = relationship("ProcessLog", back_populates="batch", cascade="all, delete-orphan")


class DepositRecord(Base):
    __tablename__ = "deposit_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    store_code = Column(String(20), index=True, nullable=False)
    deposit_date = Column(DateTime, index=True, nullable=False)
    deposit_amount = Column(Float, nullable=False)
    deposit_bank = Column(String(100))
    deposit_slip_no = Column(String(100), index=True)
    cashier = Column(String(50))
    is_duplicate = Column(Boolean, default=False)
    is_holiday_delay = Column(Boolean, default=False)
    status = Column(String(20), default="pending")  # pending, matched, over, short, returned, resolved
    mismatch_reason = Column(Text)
    handled_by = Column(String(50))
    handled_at = Column(DateTime)
    remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="deposit_records")
    process_logs = relationship("ProcessLog", back_populates="deposit_record")


class SalesRecord(Base):
    __tablename__ = "sales_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    store_code = Column(String(20), index=True, nullable=False)
    sale_date = Column(DateTime, index=True, nullable=False)
    sale_amount = Column(Float, nullable=False)
    payment_method = Column(String(50))  # cash, alipay, wechat, card
    transaction_no = Column(String(100), index=True)
    cashier = Column(String(50))
    status = Column(String(20), default="pending")
    remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="sales_records")


class PettyCashRecord(Base):
    __tablename__ = "petty_cash_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    store_code = Column(String(20), index=True, nullable=False)
    account_no = Column(String(50), index=True, nullable=False)
    trans_date = Column(DateTime, index=True, nullable=False)
    trans_type = Column(String(20), nullable=False)  # income, expense
    trans_amount = Column(Float, nullable=False)
    balance = Column(Float)
    purpose = Column(String(255))
    handler = Column(String(50))
    voucher_no = Column(String(100))
    status = Column(String(20), default="pending")
    remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="petty_cash_records")


class ProcessLog(Base):
    __tablename__ = "process_logs"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    deposit_record_id = Column(Integer, ForeignKey("deposit_records.id"))
    action = Column(String(50), nullable=False)  # create, process, return, resolve, export
    action_type = Column(String(50))  # duplicate, overage, shortage, holiday_delay, manual_correction
    reason = Column(Text, nullable=False)
    handled_by = Column(String(50), nullable=False)
    handled_at = Column(DateTime, default=datetime.utcnow)
    old_status = Column(String(20))
    new_status = Column(String(20))
    remarks = Column(Text)

    batch = relationship("Batch", back_populates="process_logs")
    deposit_record = relationship("DepositRecord", back_populates="process_logs")
