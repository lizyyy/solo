from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Filter(Base):
    __tablename__ = "filters"
    
    id = Column(Integer, primary_key=True, index=True)
    filter_id = Column(String(50), unique=True, index=True, nullable=False)
    station_name = Column(String(100), nullable=False)
    filter_type = Column(String(50), nullable=False)
    install_date = Column(DateTime, nullable=False)
    max_lifespan_days = Column(Integer, nullable=False)
    max_lifespan_liters = Column(Float, nullable=False)
    status = Column(String(20), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    water_quality_records = relationship("WaterQualityRecord", back_populates="filter")
    water_volume_records = relationship("WaterVolumeRecord", back_populates="filter")
    complaints = relationship("Complaint", back_populates="filter")
    predictions = relationship("FilterPrediction", back_populates="filter")
    replacement_reports = relationship("ReplacementReport", back_populates="filter")

class WaterQualityRecord(Base):
    __tablename__ = "water_quality_records"
    
    id = Column(Integer, primary_key=True, index=True)
    filter_id = Column(String(50), ForeignKey("filters.filter_id"), nullable=False)
    record_date = Column(DateTime, nullable=False)
    turbidity = Column(Float)
    ph = Column(Float)
    residual_chlorine = Column(Float)
    conductivity = Column(Float)
    total_dissolved_solids = Column(Float)
    color = Column(Float)
    odor = Column(String(50))
    is_valid = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    filter = relationship("Filter", back_populates="water_quality_records")

class WaterVolumeRecord(Base):
    __tablename__ = "water_volume_records"
    
    id = Column(Integer, primary_key=True, index=True)
    filter_id = Column(String(50), ForeignKey("filters.filter_id"), nullable=False)
    record_date = Column(DateTime, nullable=False)
    daily_volume_liters = Column(Float, nullable=False)
    cumulative_volume_liters = Column(Float, nullable=False)
    peak_hour = Column(String(20))
    avg_flow_rate = Column(Float)
    is_valid = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    filter = relationship("Filter", back_populates="water_volume_records")

class Complaint(Base):
    __tablename__ = "complaints"
    
    id = Column(Integer, primary_key=True, index=True)
    filter_id = Column(String(50), ForeignKey("filters.filter_id"), nullable=False)
    complaint_date = Column(DateTime, nullable=False)
    complaint_type = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(String(20), nullable=False)
    reporter = Column(String(100))
    status = Column(String(20), default="open")
    resolved_date = Column(DateTime)
    resolution = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    filter = relationship("Filter", back_populates="complaints")

class FilterPrediction(Base):
    __tablename__ = "filter_predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    filter_id = Column(String(50), ForeignKey("filters.filter_id"), nullable=False)
    prediction_date = Column(DateTime, nullable=False)
    predicted_remaining_days = Column(Integer, nullable=False)
    predicted_remaining_liters = Column(Float, nullable=False)
    health_score = Column(Float, nullable=False)
    risk_level = Column(String(20), nullable=False)
    recommendation = Column(String(100), nullable=False)
    explanation = Column(Text, nullable=False)
    confidence = Column(Float, nullable=False)
    reviewed_by = Column(String(100))
    review_date = Column(DateTime)
    review_status = Column(String(20), default="pending")
    review_comment = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    filter = relationship("Filter", back_populates="predictions")

class ReplacementReport(Base):
    __tablename__ = "replacement_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    filter_id = Column(String(50), ForeignKey("filters.filter_id"), nullable=False)
    report_date = Column(DateTime, nullable=False)
    prediction_id = Column(Integer, ForeignKey("filter_predictions.id"))
    old_filter_condition = Column(String(100), nullable=False)
    replacement_reason = Column(String(100), nullable=False)
    technician = Column(String(100))
    notes = Column(Text)
    status = Column(String(20), default="completed")
    affected_next_prediction = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    filter = relationship("Filter", back_populates="replacement_reports")
    prediction = relationship("FilterPrediction")
