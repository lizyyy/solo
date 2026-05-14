from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class LoadTestPlan(Base):
    __tablename__ = "load_test_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True)
    version = Column(String(50), index=True)
    api_name = Column(String(255))
    api_url = Column(String(500))
    method = Column(String(20))
    headers = Column(Text)
    body = Column(Text)
    status = Column(String(50), default="draft")
    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    approved_by = Column(String(100), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    remark = Column(Text, nullable=True)
    request_idempotent_key = Column(String(100), nullable=True)
    
    concurrency_steps = relationship("ConcurrencyStep", back_populates="plan", cascade="all, delete-orphan")
    response_percentiles = relationship("ResponsePercentile", back_populates="plan", cascade="all, delete-orphan")
    error_distributions = relationship("ErrorDistribution", back_populates="plan", cascade="all, delete-orphan")
    bottlenecks = relationship("Bottleneck", back_populates="plan", cascade="all, delete-orphan")
    reports = relationship("TestReport", back_populates="plan", cascade="all, delete-orphan")

class ConcurrencyStep(Base):
    __tablename__ = "concurrency_steps"
    
    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("load_test_plans.id"))
    step_order = Column(Integer)
    concurrent_users = Column(Integer)
    duration_seconds = Column(Integer)
    ramp_up_seconds = Column(Integer)
    target_qps = Column(Integer, nullable=True)
    actual_qps = Column(Float, nullable=True)
    
    plan = relationship("LoadTestPlan", back_populates="concurrency_steps")

class ResponsePercentile(Base):
    __tablename__ = "response_percentiles"
    
    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("load_test_plans.id"))
    p50 = Column(Float)
    p75 = Column(Float)
    p90 = Column(Float)
    p95 = Column(Float)
    p99 = Column(Float)
    p999 = Column(Float)
    avg_response_time = Column(Float)
    min_response_time = Column(Float)
    max_response_time = Column(Float)
    total_requests = Column(Integer)
    success_requests = Column(Integer)
    failed_requests = Column(Integer)
    
    plan = relationship("LoadTestPlan", back_populates="response_percentiles")

class ErrorDistribution(Base):
    __tablename__ = "error_distributions"
    
    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("load_test_plans.id"))
    error_type = Column(String(100))
    error_code = Column(String(50))
    error_message = Column(Text)
    count = Column(Integer)
    percentage = Column(Float)
    is_anomaly = Column(Boolean, default=False)
    anomaly_reason = Column(Text, nullable=True)
    
    plan = relationship("LoadTestPlan", back_populates="error_distributions")

class Bottleneck(Base):
    __tablename__ = "bottlenecks"
    
    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("load_test_plans.id"))
    bottleneck_type = Column(String(100))
    description = Column(Text)
    severity = Column(String(50))
    is_confirmed = Column(Boolean, default=False)
    confirmed_by = Column(String(100), nullable=True)
    confirmed_at = Column(DateTime, nullable=True)
    suggestion = Column(Text, nullable=True)
    
    plan = relationship("LoadTestPlan", back_populates="bottlenecks")

class TestReport(Base):
    __tablename__ = "test_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("load_test_plans.id"))
    report_type = Column(String(50))
    content = Column(Text)
    generated_by = Column(String(100))
    generated_at = Column(DateTime, default=datetime.utcnow)
    
    plan = relationship("LoadTestPlan", back_populates="reports")