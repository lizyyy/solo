from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, index=True, nullable=False)
    group_leader = Column(String(100), index=True, nullable=False)
    customer_name = Column(String(100))
    customer_phone = Column(String(20))
    product_name = Column(String(200), nullable=False)
    product_sku = Column(String(50))
    order_quantity = Column(Integer, nullable=False)
    order_amount = Column(Float, nullable=False)
    actual_quantity = Column(Integer)
    actual_amount = Column(Float)
    compensation_type = Column(String(20))
    compensation_amount = Column(Float)
    coupon_code = Column(String(50))
    coupon_expire_date = Column(DateTime)
    status = Column(String(20), index=True, default="pending")
    is_pass = Column(Boolean, index=True)
    review_reason = Column(Text)
    import_batch_no = Column(String(50), index=True)
    operator = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    review_logs = relationship("ReviewLog", back_populates="order")


class ReviewLog(Base):
    __tablename__ = "review_logs"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    rule_name = Column(String(100), nullable=False)
    rule_type = Column(String(50), nullable=False)
    is_pass = Column(Boolean, nullable=False)
    reason = Column(Text, nullable=False)
    detail = Column(Text)
    operator = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="review_logs")


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(50), unique=True, index=True, nullable=False)
    file_name = Column(String(200))
    total_count = Column(Integer, default=0)
    pass_count = Column(Integer, default=0)
    reject_count = Column(Integer, default=0)
    operator = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
