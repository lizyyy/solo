from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class RuleVersion(Base):
    __tablename__ = "rule_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    version = Column(String(50), unique=True, index=True)
    rule_content = Column(JSON)
    description = Column(Text)
    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    batches = relationship("Batch", back_populates="rule_version")

class Batch(Base):
    __tablename__ = "batches"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(100), unique=True, index=True)
    operator = Column(String(100))
    department = Column(String(100))
    rule_version_id = Column(Integer, ForeignKey("rule_versions.id"))
    total_records = Column(Integer, default=0)
    valid_records = Column(Integer, default=0)
    invalid_records = Column(Integer, default=0)
    swallowed_records = Column(Integer, default=0)
    status = Column(String(50), default="processing")
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    rule_version = relationship("RuleVersion", back_populates="batches")
    inquiry_forms = relationship("InquiryForm", back_populates="batch")

class InquiryForm(Base):
    __tablename__ = "inquiry_forms"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    form_no = Column(String(100), index=True)
    supplier_name = Column(String(200))
    material_code = Column(String(100))
    material_name = Column(String(200))
    specification = Column(String(300))
    quantity = Column(Float)
    unit = Column(String(50))
    quoted_price = Column(Float)
    currency = Column(String(20), default="CNY")
    delivery_period = Column(String(100))
    payment_terms = Column(String(200))
    contact_person = Column(String(100))
    contact_phone = Column(String(100))
    department = Column(String(100))
    applicant = Column(String(100))
    application_date = Column(DateTime)
    remark = Column(Text)
    
    is_valid = Column(Boolean, default=True)
    risk_type = Column(String(100), nullable=True)
    risk_level = Column(String(50), nullable=True)
    risk_description = Column(Text, nullable=True)
    is_swallowed = Column(Boolean, default=False)
    swallow_reason = Column(Text, nullable=True)
    
    processing_result = Column(String(50))
    processing_message = Column(Text)
    processed_at = Column(DateTime, default=datetime.utcnow)
    
    batch = relationship("Batch", back_populates="inquiry_forms")
