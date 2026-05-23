from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import datetime


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    phone = Column(String(20), index=True)
    address = Column(String(200))
    id_card = Column(String(50), unique=True, index=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    is_active = Column(Boolean, default=True)
    remark = Column(Text)

    credit_orders = relationship("CreditOrder", back_populates="customer")
    payments = relationship("Payment", back_populates="customer")


class CreditOrder(Base):
    __tablename__ = "credit_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    order_date = Column(DateTime, default=func.now())
    total_amount = Column(Float, default=0.0)
    discount_amount = Column(Float, default=0.0)
    return_amount = Column(Float, default=0.0)
    paid_amount = Column(Float, default=0.0)
    debt_amount = Column(Float, default=0.0)
    status = Column(String(20), default="pending")
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    remark = Column(Text)
    idempotency_key = Column(String(100), unique=True, index=True)

    customer = relationship("Customer", back_populates="credit_orders")
    items = relationship("CreditOrderItem", back_populates="order")
    returns = relationship("ReturnRecord", back_populates="order")
    payments = relationship("Payment", back_populates="order")


class CreditOrderItem(Base):
    __tablename__ = "credit_order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("credit_orders.id"), nullable=False)
    product_batch = Column(String(100), nullable=False, index=True)
    product_name = Column(String(100), nullable=False)
    quantity = Column(Float, nullable=False)
    unit_price = Column(Float, nullable=False)
    total_price = Column(Float, nullable=False)
    unit = Column(String(20))
    specification = Column(String(100))
    return_quantity = Column(Float, default=0.0)
    created_at = Column(DateTime, default=func.now())

    order = relationship("CreditOrder", back_populates="items")


class ReturnRecord(Base):
    __tablename__ = "return_records"

    id = Column(Integer, primary_key=True, index=True)
    return_no = Column(String(50), unique=True, index=True, nullable=False)
    order_id = Column(Integer, ForeignKey("credit_orders.id"), nullable=False)
    return_date = Column(DateTime, default=func.now())
    product_batch = Column(String(100), nullable=False)
    product_name = Column(String(100), nullable=False)
    quantity = Column(Float, nullable=False)
    unit_price = Column(Float, nullable=False)
    total_amount = Column(Float, nullable=False)
    reason = Column(String(200))
    created_at = Column(DateTime, default=func.now())
    idempotency_key = Column(String(100), unique=True, index=True)

    order = relationship("CreditOrder", back_populates="returns")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    payment_no = Column(String(50), unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("credit_orders.id"))
    payment_date = Column(DateTime, default=func.now())
    amount = Column(Float, nullable=False)
    payment_method = Column(String(50))
    status = Column(String(20), default="confirmed")
    remark = Column(Text)
    created_at = Column(DateTime, default=func.now())
    idempotency_key = Column(String(100), unique=True, index=True)

    customer = relationship("Customer", back_populates="payments")
    order = relationship("CreditOrder", back_populates="payments")


class DebtReport(Base):
    __tablename__ = "debt_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_no = Column(String(50), unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    customer_name = Column(String(100))
    report_date = Column(DateTime, default=func.now())
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    total_debt = Column(Float, default=0.0)
    total_paid = Column(Float, default=0.0)
    total_return = Column(Float, default=0.0)
    net_debt = Column(Float, default=0.0)
    order_count = Column(Integer, default=0)
    status = Column(String(20), default="generated")
    file_path = Column(String(200))
    created_at = Column(DateTime, default=func.now())


class ExceptionLog(Base):
    __tablename__ = "exception_logs"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String(100), index=True)
    endpoint = Column(String(200))
    method = Column(String(20))
    raw_input = Column(Text)
    error_message = Column(Text)
    error_type = Column(String(100))
    resolution = Column(String(200))
    status = Column(String(20), default="pending")
    created_at = Column(DateTime, default=func.now())
    resolved_at = Column(DateTime)
    resolved_by = Column(String(100))
