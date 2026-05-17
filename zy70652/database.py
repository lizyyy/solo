from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./community_accounting.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Leader(Base):
    __tablename__ = "leaders"
    
    id = Column(Integer, primary_key=True, index=True)
    leader_code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    phone = Column(String)
    email = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    orders = relationship("Order", back_populates="leader")
    commission_rules = relationship("CommissionRule", back_populates="leader")


class CommissionRule(Base):
    __tablename__ = "commission_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    leader_id = Column(Integer, ForeignKey("leaders.id"), nullable=True)
    tier_min = Column(Float, nullable=False)
    tier_max = Column(Float)
    commission_rate = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    leader = relationship("Leader", back_populates="commission_rules")


class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String, unique=True, index=True, nullable=False)
    leader_id = Column(Integer, ForeignKey("leaders.id"), nullable=False)
    user_name = Column(String)
    user_phone = Column(String)
    total_amount = Column(Float, nullable=False)
    product_count = Column(Integer, default=1)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_duplicate = Column(Boolean, default=False)
    duplicate_of = Column(Integer)
    settlement_id = Column(Integer, ForeignKey("settlements.id"))
    
    leader = relationship("Leader", back_populates="orders")
    refunds = relationship("Refund", back_populates="order")
    settlement = relationship("Settlement", back_populates="orders")


class Refund(Base):
    __tablename__ = "refunds"
    
    id = Column(Integer, primary_key=True, index=True)
    refund_no = Column(String, unique=True, index=True, nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    refund_amount = Column(Float, nullable=False)
    refund_reason = Column(Text)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime)
    processed_by = Column(String)
    settlement_id = Column(Integer, ForeignKey("settlements.id"))
    
    order = relationship("Order", back_populates="refunds")
    settlement = relationship("Settlement", back_populates="refunds")


class ServiceFee(Base):
    __tablename__ = "service_fees"
    
    id = Column(Integer, primary_key=True, index=True)
    fee_rate = Column(Float, nullable=False)
    min_fee = Column(Float, default=0)
    max_fee = Column(Float)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Settlement(Base):
    __tablename__ = "settlements"
    
    id = Column(Integer, primary_key=True, index=True)
    settlement_no = Column(String, unique=True, index=True, nullable=False)
    leader_id = Column(Integer, ForeignKey("leaders.id"), nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    
    total_order_amount = Column(Float, default=0)
    total_refund_amount = Column(Float, default=0)
    net_order_amount = Column(Float, default=0)
    service_fee = Column(Float, default=0)
    commission_amount = Column(Float, default=0)
    final_leader_amount = Column(Float, default=0)
    
    status = Column(String, default="draft")
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime)
    processed_by = Column(String)
    closed_by = Column(String)
    closed_at = Column(DateTime)
    close_reason = Column(Text)
    
    orders = relationship("Order", back_populates="settlement")
    refunds = relationship("Refund", back_populates="settlement")
    adjustments = relationship("Adjustment", back_populates="settlement")
    audit_logs = relationship("AuditLog", back_populates="settlement")


class Adjustment(Base):
    __tablename__ = "adjustments"
    
    id = Column(Integer, primary_key=True, index=True)
    settlement_id = Column(Integer, ForeignKey("settlements.id"), nullable=False)
    adjustment_type = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    reason = Column(Text, nullable=False)
    processed_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    settlement = relationship("Settlement", back_populates="adjustments")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    settlement_id = Column(Integer, ForeignKey("settlements.id"))
    action = Column(String, nullable=False)
    original_input = Column(Text)
    processed_by = Column(String, nullable=False)
    conclusion = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    settlement = relationship("Settlement", back_populates="audit_logs")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
