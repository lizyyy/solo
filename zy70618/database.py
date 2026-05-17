from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./credit_sales.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    phone = Column(String(20), index=True)
    address = Column(String(200))
    village = Column(String(100))
    created_at = Column(DateTime, default=datetime.now)
    is_active = Column(Boolean, default=True)

    sales_orders = relationship("SalesOrder", back_populates="customer")


class SalesOrder(Base):
    __tablename__ = "sales_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    order_date = Column(DateTime, default=datetime.now)
    total_amount = Column(Float, default=0.0)
    discount_amount = Column(Float, default=0.0)
    actual_amount = Column(Float, default=0.0)
    paid_amount = Column(Float, default=0.0)
    returned_amount = Column(Float, default=0.0)
    debt_amount = Column(Float, default=0.0)
    status = Column(String(20), default="pending")
    remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    customer = relationship("Customer", back_populates="sales_orders")
    items = relationship("SalesOrderItem", back_populates="order")
    returns = relationship("ReturnRecord", back_populates="order")
    payments = relationship("PaymentRecord", back_populates="order")


class SalesOrderItem(Base):
    __tablename__ = "sales_order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("sales_orders.id"))
    product_name = Column(String(100), nullable=False)
    product_batch = Column(String(50))
    unit = Column(String(20))
    quantity = Column(Float, nullable=False)
    unit_price = Column(Float, nullable=False)
    total_price = Column(Float, nullable=False)
    returned_quantity = Column(Float, default=0.0)

    order = relationship("SalesOrder", back_populates="items")


class ReturnRecord(Base):
    __tablename__ = "return_records"

    id = Column(Integer, primary_key=True, index=True)
    return_no = Column(String(50), unique=True, index=True)
    order_id = Column(Integer, ForeignKey("sales_orders.id"))
    return_date = Column(DateTime, default=datetime.now)
    total_amount = Column(Float, nullable=False)
    deduction_amount = Column(Float, default=0.0)
    status = Column(String(20), default="pending")
    remarks = Column(Text)
    idempotent_key = Column(String(100), unique=True, index=True)
    created_at = Column(DateTime, default=datetime.now)

    order = relationship("SalesOrder", back_populates="returns")
    items = relationship("ReturnItem", back_populates="return_record")


class ReturnItem(Base):
    __tablename__ = "return_items"

    id = Column(Integer, primary_key=True, index=True)
    return_id = Column(Integer, ForeignKey("return_records.id"))
    order_item_id = Column(Integer, ForeignKey("sales_order_items.id"))
    product_name = Column(String(100))
    quantity = Column(Float, nullable=False)
    unit_price = Column(Float, nullable=False)
    total_price = Column(Float, nullable=False)
    reason = Column(String(200))

    return_record = relationship("ReturnRecord", back_populates="items")


class PaymentRecord(Base):
    __tablename__ = "payment_records"

    id = Column(Integer, primary_key=True, index=True)
    payment_no = Column(String(50), unique=True, index=True)
    order_id = Column(Integer, ForeignKey("sales_orders.id"))
    payment_date = Column(DateTime, default=datetime.now)
    amount = Column(Float, nullable=False)
    payment_method = Column(String(50))
    status = Column(String(20), default="confirmed")
    remarks = Column(Text)
    idempotent_key = Column(String(100), unique=True, index=True)
    created_at = Column(DateTime, default=datetime.now)

    order = relationship("SalesOrder", back_populates="payments")


class DebtReport(Base):
    __tablename__ = "debt_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_no = Column(String(50), unique=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    report_date = Column(DateTime, default=datetime.now)
    period_start = Column(DateTime)
    period_end = Column(DateTime)
    total_debt = Column(Float, default=0.0)
    total_paid = Column(Float, default=0.0)
    total_returned = Column(Float, default=0.0)
    final_debt = Column(Float, default=0.0)
    status = Column(String(20), default="draft")
    need_review = Column(Boolean, default=False)
    review_remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.now)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
