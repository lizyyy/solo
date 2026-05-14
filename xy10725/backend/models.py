from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(64), unique=True, index=True, nullable=False)
    version = Column(String(32), nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(String(32), default="pending")
    raw_input = Column(Text, nullable=False)
    processed_result = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    callbacks = relationship("Callback", back_populates="order")
    refunds = relationship("Refund", back_populates="order")
    bills = relationship("Bill", back_populates="order")
    replenishments = relationship("Replenishment", back_populates="order")
    reports = relationship("ReconciliationReport", back_populates="order")

class Callback(Base):
    __tablename__ = "callbacks"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    callback_type = Column(String(32), nullable=False)
    status = Column(String(32), default="pending")
    raw_data = Column(Text, nullable=False)
    processed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    order = relationship("Order", back_populates="callbacks")

class Refund(Base):
    __tablename__ = "refunds"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    refund_no = Column(String(64), unique=True, index=True)
    amount = Column(Float, nullable=False)
    status = Column(String(32), default="pending")
    reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    order = relationship("Order", back_populates="refunds")

class Bill(Base):
    __tablename__ = "bills"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    bill_no = Column(String(64), nullable=False)
    bill_amount = Column(Float, nullable=False)
    order_amount = Column(Float, nullable=False)
    difference = Column(Float, nullable=False)
    status = Column(String(32), default="pending")
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    order = relationship("Order", back_populates="bills")

class Replenishment(Base):
    __tablename__ = "replenishments"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    action_type = Column(String(32), nullable=False)
    reason = Column(Text, nullable=False)
    operator = Column(String(64), nullable=False)
    before_status = Column(String(32))
    after_status = Column(String(32))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    order = relationship("Order", back_populates="replenishments")

class ReconciliationReport(Base):
    __tablename__ = "reports"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    report_no = Column(String(64), unique=True, index=True)
    content = Column(Text, nullable=False)
    status = Column(String(32), default="draft")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    order = relationship("Order", back_populates="reports")
