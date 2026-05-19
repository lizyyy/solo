from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()


class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, index=True, nullable=False)
    property_name = Column(String(100), nullable=False)
    guest_name = Column(String(50))
    check_in_date = Column(DateTime)
    check_out_date = Column(DateTime)
    status = Column(String(20), default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    cleaning_tasks = relationship("CleaningTask", back_populates="order")
    settlements = relationship("Settlement", back_populates="order")


class Cleaner(Base):
    __tablename__ = "cleaners"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    phone = Column(String(20), unique=True)
    base_salary = Column(Float, default=0)
    score = Column(Float, default=100)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    cleaning_tasks = relationship("CleaningTask", back_populates="cleaner")


class CleaningTask(Base):
    __tablename__ = "cleaning_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    task_no = Column(String(50), unique=True, index=True, nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"))
    cleaner_id = Column(Integer, ForeignKey("cleaners.id"))
    assigned_at = Column(DateTime, default=datetime.utcnow)
    deadline = Column(DateTime, nullable=False)
    status = Column(String(20), default="assigned")
    base_fee = Column(Float, default=0)
    deduction_amount = Column(Float, default=0)
    final_fee = Column(Float, default=0)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    order = relationship("Order", back_populates="cleaning_tasks")
    cleaner = relationship("Cleaner", back_populates="cleaning_tasks")
    photos = relationship("CleaningPhoto", back_populates="task")
    inspections = relationship("Inspection", back_populates="task")
    reworks = relationship("Rework", back_populates="task")
    deductions = relationship("Deduction", back_populates="task")


class CleaningPhoto(Base):
    __tablename__ = "cleaning_photos"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("cleaning_tasks.id"))
    photo_type = Column(String(30), nullable=False)
    photo_url = Column(String(255))
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    uploaded_by = Column(String(50))
    
    task = relationship("CleaningTask", back_populates="photos")


class Inspection(Base):
    __tablename__ = "inspections"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("cleaning_tasks.id"))
    inspector = Column(String(50))
    inspected_at = Column(DateTime, default=datetime.utcnow)
    passed = Column(Boolean, default=False)
    comments = Column(Text)
    reason = Column(String(200))
    
    task = relationship("CleaningTask", back_populates="inspections")


class Rework(Base):
    __tablename__ = "reworks"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("cleaning_tasks.id"))
    requested_at = Column(DateTime, default=datetime.utcnow)
    requested_by = Column(String(50))
    reason = Column(Text, nullable=False)
    deadline = Column(DateTime)
    completed_at = Column(DateTime)
    completed = Column(Boolean, default=False)
    affects_settlement = Column(Boolean, default=True)
    
    task = relationship("CleaningTask", back_populates="reworks")


class Deduction(Base):
    __tablename__ = "deductions"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("cleaning_tasks.id"))
    deduction_type = Column(String(50), nullable=False)
    amount = Column(Float, nullable=False)
    reason = Column(Text, nullable=False)
    applied_at = Column(DateTime, default=datetime.utcnow)
    applied_by = Column(String(50))
    
    task = relationship("CleaningTask", back_populates="deductions")


class Settlement(Base):
    __tablename__ = "settlements"
    
    id = Column(Integer, primary_key=True, index=True)
    settlement_no = Column(String(50), unique=True, index=True, nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"))
    cleaner_id = Column(Integer)
    total_base_fee = Column(Float, default=0)
    total_deductions = Column(Float, default=0)
    final_amount = Column(Float, default=0)
    status = Column(String(20), default="draft")
    settled_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text)
    
    order = relationship("Order", back_populates="settlements")
    items = relationship("SettlementItem", back_populates="settlement")


class SettlementItem(Base):
    __tablename__ = "settlement_items"
    
    id = Column(Integer, primary_key=True, index=True)
    settlement_id = Column(Integer, ForeignKey("settlements.id"))
    task_id = Column(Integer)
    base_fee = Column(Float, default=0)
    deductions = Column(Float, default=0)
    final_fee = Column(Float, default=0)
    remarks = Column(Text)
    
    settlement = relationship("Settlement", back_populates="items")


class OperationLog(Base):
    __tablename__ = "operation_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String(50), nullable=False)
    reference_id = Column(String(50))
    status = Column(String(20), default="success")
    message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    operator = Column(String(50))