from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class FlyAshBatch(Base):
    __tablename__ = "fly_ash_batches"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String(50), unique=True, index=True, nullable=False)
    batch_date = Column(DateTime, nullable=False)
    ash_source = Column(String(100))
    total_weight = Column(Float, default=0.0)
    bag_count = Column(Integer, default=0)
    chelating_agent_type = Column(String(100))
    chelating_agent_dosage = Column(Float, default=0.0)
    mixing_duration = Column(Float, default=0.0)
    operator = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    ton_bags = relationship("TonBag", back_populates="batch")
    inspections = relationship("InspectionRecord", back_populates="batch")
    reservations = relationship("LandfillReservation", back_populates="batch")
    review_notes = relationship("ReviewNote", back_populates="batch")

class TonBag(Base):
    __tablename__ = "ton_bags"
    
    id = Column(Integer, primary_key=True, index=True)
    bag_number = Column(String(50), unique=True, index=True, nullable=False)
    batch_id = Column(Integer, ForeignKey("fly_ash_batches.id"), nullable=False)
    weight = Column(Float, nullable=False)
    rfid_tag = Column(String(100))
    storage_location = Column(String(100))
    production_time = Column(DateTime)
    inspection_status = Column(String(20), default="pending")
    risk_level = Column(String(20), default="unknown")
    is_qualified = Column(Boolean, default=False)
    is_outbound = Column(Boolean, default=False)
    outbound_time = Column(DateTime)
    reservation_id = Column(Integer, ForeignKey("landfill_reservations.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    batch = relationship("FlyAshBatch", back_populates="ton_bags")
    inspections = relationship("InspectionRecord", back_populates="ton_bag")
    reservation = relationship("LandfillReservation", back_populates="ton_bags")

class InspectionRecord(Base):
    __tablename__ = "inspection_records"
    
    id = Column(Integer, primary_key=True, index=True)
    inspection_number = Column(String(50), unique=True, index=True, nullable=False)
    batch_id = Column(Integer, ForeignKey("fly_ash_batches.id"))
    bag_id = Column(Integer, ForeignKey("ton_bags.id"))
    inspection_type = Column(String(50))
    inspection_date = Column(DateTime, nullable=False)
    inspector = Column(String(100))
    leaching_pb = Column(Float)
    leaching_cd = Column(Float)
    leaching_cr = Column(Float)
    leaching_hg = Column(Float)
    leaching_as = Column(Float)
    leaching_zn = Column(Float)
    leaching_cu = Column(Float)
    leaching_ni = Column(Float)
    is_qualified = Column(Boolean, default=False)
    inspection_report = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    batch = relationship("FlyAshBatch", back_populates="inspections")
    ton_bag = relationship("TonBag", back_populates="inspections")

class LandfillReservation(Base):
    __tablename__ = "landfill_reservations"
    
    id = Column(Integer, primary_key=True, index=True)
    reservation_number = Column(String(50), unique=True, index=True, nullable=False)
    batch_id = Column(Integer, ForeignKey("fly_ash_batches.id"))
    reservation_date = Column(DateTime, nullable=False)
    planned_outbound_date = Column(DateTime)
    landfill_site = Column(String(200))
    transport_company = Column(String(200))
    vehicle_number = Column(String(100))
    driver_name = Column(String(100))
    driver_phone = Column(String(50))
    reserved_weight = Column(Float, nullable=False)
    actual_weight = Column(Float)
    status = Column(String(20), default="pending")
    is_completed = Column(Boolean, default=False)
    completion_time = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    batch = relationship("FlyAshBatch", back_populates="reservations")
    ton_bags = relationship("TonBag", back_populates="reservation")
    review_notes = relationship("ReviewNote", back_populates="reservation")

class ReviewNote(Base):
    __tablename__ = "review_notes"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("fly_ash_batches.id"))
    reservation_id = Column(Integer, ForeignKey("landfill_reservations.id"))
    bag_id = Column(Integer, ForeignKey("ton_bags.id"))
    reviewer = Column(String(100), nullable=False)
    review_time = Column(DateTime, default=datetime.utcnow)
    risk_assessment = Column(String(20), default="normal")
    note_content = Column(Text, nullable=False)
    is_exception = Column(Boolean, default=False)
    exception_reason = Column(Text)
    approved_by = Column(String(100))
    approval_time = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    batch = relationship("FlyAshBatch", back_populates="review_notes")
    reservation = relationship("LandfillReservation", back_populates="review_notes")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    log_time = Column(DateTime, default=datetime.utcnow, index=True)
    operation_type = Column(String(50), nullable=False)
    module = Column(String(50))
    resource_type = Column(String(50))
    resource_id = Column(String(100))
    operator = Column(String(100))
    ip_address = Column(String(50))
    operation_detail = Column(Text)
    old_value = Column(Text)
    new_value = Column(Text)
    is_successful = Column(Boolean, default=True)
    failure_reason = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
