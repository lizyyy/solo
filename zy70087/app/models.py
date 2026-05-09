from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Float, Date
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Elderly(Base):
    __tablename__ = "elderly"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    id_card = Column(String(18), unique=True, nullable=False)
    gender = Column(String(10), nullable=False)
    birth_date = Column(Date, nullable=False)
    address = Column(String(500), nullable=False)
    phone = Column(String(20))
    family_contact_name = Column(String(100), nullable=False)
    family_contact_phone = Column(String(20), nullable=False)
    health_status = Column(String(500))
    special_needs = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    plans = relationship("VisitPlan", back_populates="elderly", cascade="all, delete-orphan")
    visits = relationship("VisitRecord", back_populates="elderly", cascade="all, delete-orphan")
    exceptions = relationship("ExceptionReport", back_populates="elderly", cascade="all, delete-orphan")

class VisitPlan(Base):
    __tablename__ = "visit_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    elderly_id = Column(Integer, ForeignKey("elderly.id"), nullable=False)
    plan_date = Column(Date, nullable=False)
    plan_time = Column(String(20), nullable=False)
    visit_type = Column(String(50), nullable=False)
    caregiver = Column(String(100), nullable=False)
    caregiver_phone = Column(String(20))
    status = Column(String(20), default="pending")
    task_idempotency_key = Column(String(100), unique=True, nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    elderly = relationship("Elderly", back_populates="plans")
    visits = relationship("VisitRecord", back_populates="plan", cascade="all, delete-orphan")
    exceptions = relationship("ExceptionReport", back_populates="plan", cascade="all, delete-orphan")
    merge_history = relationship("TaskMergeHistory", back_populates="plan", cascade="all, delete-orphan")
    operation_history = relationship("OperationHistory", back_populates="visit_plan", cascade="all, delete-orphan")

class VisitRecord(Base):
    __tablename__ = "visit_records"
    
    id = Column(Integer, primary_key=True, index=True)
    elderly_id = Column(Integer, ForeignKey("elderly.id"), nullable=False)
    plan_id = Column(Integer, ForeignKey("visit_plans.id"), nullable=True)
    visit_date = Column(Date, nullable=False)
    check_in_time = Column(DateTime, nullable=False)
    check_out_time = Column(DateTime)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location_accuracy = Column(Float)
    caregiver = Column(String(100), nullable=False)
    actual_visit_type = Column(String(50))
    is_backdated = Column(Boolean, default=False)
    backdated_reason = Column(String(500))
    health_condition = Column(String(500))
    services_provided = Column(Text)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    elderly = relationship("Elderly", back_populates="visits")
    plan = relationship("VisitPlan", back_populates="visits")

class ExceptionReport(Base):
    __tablename__ = "exception_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    elderly_id = Column(Integer, ForeignKey("elderly.id"), nullable=False)
    plan_id = Column(Integer, ForeignKey("visit_plans.id"), nullable=True)
    exception_type = Column(String(50), nullable=False)
    exception_level = Column(String(20), nullable=False)
    report_time = Column(DateTime, nullable=False)
    reported_by = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    location = Column(String(500))
    latitude = Column(Float)
    longitude = Column(Float)
    status = Column(String(20), default="pending")
    resolved_time = Column(DateTime)
    resolution = Column(Text)
    resolved_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    elderly = relationship("Elderly", back_populates="exceptions")
    plan = relationship("VisitPlan", back_populates="exceptions")
    notifications = relationship("Notification", back_populates="exception_report", cascade="all, delete-orphan")

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    exception_id = Column(Integer, ForeignKey("exception_reports.id"), nullable=False)
    recipient_type = Column(String(20), nullable=False)
    recipient_name = Column(String(100), nullable=False)
    recipient_phone = Column(String(20), nullable=False)
    notification_type = Column(String(50), nullable=False)
    content = Column(Text, nullable=False)
    send_time = Column(DateTime, default=datetime.utcnow)
    delivery_status = Column(String(20), default="sent")
    ack_time = Column(DateTime)
    ack_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    exception_report = relationship("ExceptionReport", back_populates="notifications")

class TaskMergeHistory(Base):
    __tablename__ = "task_merge_history"
    
    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("visit_plans.id"), nullable=False)
    merged_from_plan_ids = Column(String(500), nullable=False)
    merge_reason = Column(String(500), nullable=False)
    merged_by = Column(String(100), nullable=False)
    merge_time = Column(DateTime, default=datetime.utcnow)
    
    plan = relationship("VisitPlan", back_populates="merge_history")

class OperationHistory(Base):
    __tablename__ = "operation_history"
    
    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("visit_plans.id"), nullable=False)
    record_id = Column(Integer)
    record_type = Column(String(50))
    operation_type = Column(String(50), nullable=False)
    operation_detail = Column(Text, nullable=False)
    operator = Column(String(100), nullable=False)
    operation_time = Column(DateTime, default=datetime.utcnow)
    original_data = Column(Text)
    new_data = Column(Text)
    
    visit_plan = relationship("VisitPlan", back_populates="operation_history")
