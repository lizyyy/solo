from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class PaperBatch(Base):
    __tablename__ = "paper_batches"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String, unique=True, index=True, nullable=False)
    paper_type = Column(String, nullable=False)
    supplier = Column(String)
    production_date = Column(DateTime)
    received_date = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text)
    
    quality_records = relationship("QualityRecord", back_populates="paper_batch")

class QualityThreshold(Base):
    __tablename__ = "quality_thresholds"
    
    id = Column(Integer, primary_key=True, index=True)
    product_type = Column(String, index=True, nullable=False)
    color_name = Column(String, index=True, nullable=False)
    l_min = Column(Float, nullable=False)
    l_max = Column(Float, nullable=False)
    a_min = Column(Float, nullable=False)
    a_max = Column(Float, nullable=False)
    b_min = Column(Float, nullable=False)
    b_max = Column(Float, nullable=False)
    delta_e_max = Column(Float, default=2.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class QualityRecord(Base):
    __tablename__ = "quality_records"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String, index=True, nullable=False)
    product_type = Column(String, nullable=False)
    paper_batch_id = Column(Integer, ForeignKey("paper_batches.id"))
    inspector = Column(String, index=True, nullable=False)
    inspection_time = Column(DateTime, default=datetime.utcnow, index=True)
    status = Column(String, index=True, nullable=False)
    overall_result = Column(String, index=True, nullable=False)
    reason = Column(Text, nullable=False)
    anomaly_type = Column(String, index=True)
    sample_retained = Column(Boolean, default=False)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    paper_batch = relationship("PaperBatch", back_populates="quality_records")
    lab_measurements = relationship("LabMeasurement", back_populates="quality_record", cascade="all, delete-orphan")
    rework_records = relationship("ReworkRecord", back_populates="quality_record", cascade="all, delete-orphan")

class LabMeasurement(Base):
    __tablename__ = "lab_measurements"
    
    id = Column(Integer, primary_key=True, index=True)
    quality_record_id = Column(Integer, ForeignKey("quality_records.id"), nullable=False)
    measurement_point = Column(String, nullable=False)
    l_value = Column(Float, nullable=False)
    a_value = Column(Float, nullable=False)
    b_value = Column(Float, nullable=False)
    standard_l = Column(Float)
    standard_a = Column(Float)
    standard_b = Column(Float)
    delta_l = Column(Float)
    delta_a = Column(Float)
    delta_b = Column(Float)
    delta_e = Column(Float)
    is_anomaly = Column(Boolean, default=False)
    anomaly_reason = Column(Text)
    measured_at = Column(DateTime, default=datetime.utcnow)
    
    quality_record = relationship("QualityRecord", back_populates="lab_measurements")

class ReworkRecord(Base):
    __tablename__ = "rework_records"
    
    id = Column(Integer, primary_key=True, index=True)
    quality_record_id = Column(Integer, ForeignKey("quality_records.id"), nullable=False)
    rework_type = Column(String, nullable=False)
    rework_reason = Column(Text, nullable=False)
    operator = Column(String)
    rework_time = Column(DateTime, default=datetime.utcnow)
    result = Column(String, nullable=False)
    notes = Column(Text)
    
    quality_record = relationship("QualityRecord", back_populates="rework_records")
