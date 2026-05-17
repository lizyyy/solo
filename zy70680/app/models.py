from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class UserAccount(Base):
    __tablename__ = "user_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(64), unique=True, index=True, nullable=False)
    user_name = Column(String(128))
    phone = Column(String(32))
    balance = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    orders = relationship("OrderDraft", back_populates="user")
    compensations = relationship("CompensationRecord", back_populates="user")


class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(String(128), unique=True, index=True, nullable=False)
    user_id = Column(String(64), index=True, nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String(16), default="CNY")
    pay_channel = Column(String(64))
    pay_time = Column(DateTime(timezone=True))
    pay_status = Column(String(32), default="SUCCESS")
    raw_data = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    order = relationship("OrderDraft", back_populates="transaction", uselist=False)
    compensation = relationship("CompensationRecord", back_populates="transaction", uselist=False)


class OrderDraft(Base):
    __tablename__ = "order_drafts"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(128), unique=True, index=True)
    transaction_id = Column(String(128), ForeignKey("payment_transactions.transaction_id"), unique=True)
    user_id = Column(String(64), ForeignKey("user_accounts.user_id"))
    amount = Column(Float, nullable=False)
    product_info = Column(Text)
    order_status = Column(String(32), default="DRAFT")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    transaction = relationship("PaymentTransaction", back_populates="order")
    user = relationship("UserAccount", back_populates="orders")
    compensation = relationship("CompensationRecord", back_populates="order", uselist=False)


class Handler(Base):
    __tablename__ = "handlers"

    id = Column(Integer, primary_key=True, index=True)
    handler_id = Column(String(64), unique=True, index=True, nullable=False)
    handler_name = Column(String(128), nullable=False)
    department = Column(String(128))
    role = Column(String(64))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    compensation_records = relationship("CompensationRecord", back_populates="handler")


class CompensationVoucher(Base):
    __tablename__ = "compensation_vouchers"

    id = Column(Integer, primary_key=True, index=True)
    voucher_code = Column(String(128), unique=True, index=True, nullable=False)
    voucher_type = Column(String(64))
    amount = Column(Float, nullable=False)
    min_spend = Column(Float, default=0.0)
    valid_days = Column(Integer, default=30)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    compensation_records = relationship("CompensationRecord", back_populates="voucher")


class CompensationRecord(Base):
    __tablename__ = "compensation_records"

    id = Column(Integer, primary_key=True, index=True)
    record_no = Column(String(128), unique=True, index=True, nullable=False)
    transaction_id = Column(String(128), ForeignKey("payment_transactions.transaction_id"))
    order_no = Column(String(128), ForeignKey("order_drafts.order_no"))
    user_id = Column(String(64), ForeignKey("user_accounts.user_id"))
    handler_id = Column(String(64), ForeignKey("handlers.handler_id"))
    voucher_id = Column(Integer, ForeignKey("compensation_vouchers.id"))

    status = Column(String(32), default="PENDING", index=True)
    compensation_type = Column(String(64))
    compensation_amount = Column(Float)
    reason = Column(Text)
    conclusion = Column(Text)
    raw_input = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    transaction = relationship("PaymentTransaction", back_populates="compensation")
    order = relationship("OrderDraft", back_populates="compensation")
    user = relationship("UserAccount", back_populates="compensations")
    handler = relationship("Handler", back_populates="compensation_records")
    voucher = relationship("CompensationVoucher", back_populates="compensation_records")
    report = relationship("CompensationReport", back_populates="record", uselist=False)
    operation_logs = relationship("OperationLog", back_populates="record")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("compensation_records.id"))
    handler_id = Column(String(64))
    operation = Column(String(128))
    old_status = Column(String(32))
    new_status = Column(String(32))
    remark = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    record = relationship("CompensationRecord", back_populates="operation_logs")


class CompensationReport(Base):
    __tablename__ = "compensation_reports"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("compensation_records.id"), unique=True)
    report_no = Column(String(128), unique=True, index=True, nullable=False)

    transaction_info = Column(Text)
    order_info = Column(Text)
    user_info = Column(Text)
    handler_info = Column(Text)
    compensation_info = Column(Text)
    operation_history = Column(Text)

    exported_at = Column(DateTime(timezone=True))
    exported_by = Column(String(64))

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    record = relationship("CompensationRecord", back_populates="report")
