from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./water_bucket.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), unique=True, index=True, nullable=False)
    address = Column(Text)
    total_deposit = Column(Float, default=0.0)
    used_deposit = Column(Float, default=0.0)
    available_deposit = Column(Float, default=0.0)
    pending_buckets = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    deposit_records = relationship("DepositRecord", back_populates="customer")
    deliveries = relationship("Delivery", back_populates="customer")
    returns = relationship("BucketReturn", back_populates="customer")


class Bucket(Base):
    __tablename__ = "buckets"

    id = Column(Integer, primary_key=True, index=True)
    bucket_number = Column(String(50), unique=True, index=True, nullable=False)
    status = Column(String(20), default="in_stock")
    current_customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    deposit_amount = Column(Float, default=50.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    deliveries = relationship("DeliveryBucket", back_populates="bucket")
    returns = relationship("ReturnBucket", back_populates="bucket")


class DepositRecord(Base):
    __tablename__ = "deposit_records"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    transaction_no = Column(String(50), unique=True, index=True, nullable=False)
    amount = Column(Float, nullable=False)
    record_type = Column(String(20), nullable=False)
    status = Column(String(20), default="pending")
    related_order_no = Column(String(50))
    notes = Column(Text)
    processed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer", back_populates="deposit_records")


class Delivery(Base):
    __tablename__ = "deliveries"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    delivery_address = Column(Text, nullable=False)
    quantity = Column(Integer, nullable=False)
    deposit_per_bucket = Column(Float, default=50.0)
    total_deposit = Column(Float, nullable=False)
    use_deposit_credit = Column(Float, default=0.0)
    actual_pay_deposit = Column(Float, nullable=False)
    status = Column(String(20), default="delivered")
    notes = Column(Text)
    delivered_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer", back_populates="deliveries")
    buckets = relationship("DeliveryBucket", back_populates="delivery")


class DeliveryBucket(Base):
    __tablename__ = "delivery_buckets"

    id = Column(Integer, primary_key=True, index=True)
    delivery_id = Column(Integer, ForeignKey("deliveries.id"), nullable=False)
    bucket_id = Column(Integer, ForeignKey("buckets.id"), nullable=False)

    delivery = relationship("Delivery", back_populates="buckets")
    bucket = relationship("Bucket", back_populates="deliveries")


class BucketReturn(Base):
    __tablename__ = "bucket_returns"

    id = Column(Integer, primary_key=True, index=True)
    return_no = Column(String(50), unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    refund_amount = Column(Float, nullable=False)
    deduct_amount = Column(Float, default=0.0)
    actual_refund = Column(Float, nullable=False)
    status = Column(String(20), default="completed")
    notes = Column(Text)
    returned_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer", back_populates="returns")
    buckets = relationship("ReturnBucket", back_populates="return_record")


class ReturnBucket(Base):
    __tablename__ = "return_buckets"

    id = Column(Integer, primary_key=True, index=True)
    return_id = Column(Integer, ForeignKey("bucket_returns.id"), nullable=False)
    bucket_id = Column(Integer, ForeignKey("buckets.id"), nullable=False)

    return_record = relationship("BucketReturn", back_populates="buckets")
    bucket = relationship("Bucket", back_populates="returns")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
