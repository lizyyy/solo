from datetime import datetime
from enum import Enum
from typing import Optional
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class CircuitBreakerStatus(Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


class Supplier(Base):
    __tablename__ = "suppliers"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    code = Column(String(50), nullable=False, unique=True)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    quota_windows = relationship("QuotaWindow", back_populates="supplier")
    circuit_breaker_events = relationship("CircuitBreakerEvent", back_populates="supplier")


class QuotaWindow(Base):
    __tablename__ = "quota_windows"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    window_type = Column(String(50), nullable=False)
    total_quota = Column(Integer, nullable=False)
    used_quota = Column(Integer, default=0)
    warning_threshold = Column(Float, default=0.8)
    circuit_breaker_threshold = Column(Float, default=0.95)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    supplier = relationship("Supplier", back_populates="quota_windows")
    quota_usages = relationship("QuotaUsage", back_populates="quota_window")


class BusinessTag(Base):
    __tablename__ = "business_tags"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    code = Column(String(50), nullable=False, unique=True)
    priority = Column(Integer, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    quota_usages = relationship("QuotaUsage", back_populates="business_tag")


class QuotaUsage(Base):
    __tablename__ = "quota_usages"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    quota_window_id = Column(Integer, ForeignKey("quota_windows.id"), nullable=False)
    business_tag_id = Column(Integer, ForeignKey("business_tags.id"), nullable=False)
    request_id = Column(String(100), unique=True)
    amount = Column(Integer, nullable=False)
    raw_input = Column(Text)
    processing_rule = Column(Text)
    conclusion = Column(String(200))
    status = Column(String(50), nullable=False)
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    quota_window = relationship("QuotaWindow", back_populates="quota_usages")
    business_tag = relationship("BusinessTag", back_populates="quota_usages")


class CircuitBreakerEvent(Base):
    __tablename__ = "circuit_breaker_events"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    quota_window_id = Column(Integer, ForeignKey("quota_windows.id"))
    status = Column(String(50), nullable=False)
    reason = Column(Text)
    triggered_at = Column(DateTime, default=datetime.utcnow)
    recovered_at = Column(DateTime)
    recovery_reason = Column(Text)
    
    supplier = relationship("Supplier", back_populates="circuit_breaker_events")


class QuotaReport(Base):
    __tablename__ = "quota_reports"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    quota_window_id = Column(Integer, ForeignKey("quota_windows.id"))
    report_type = Column(String(50), nullable=False)
    content = Column(Text, nullable=False)
    generated_at = Column(DateTime, default=datetime.utcnow)
    generated_by = Column(String(100))
