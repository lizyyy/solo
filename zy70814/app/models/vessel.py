from sqlalchemy import Column, String, Float, DateTime, Integer, Boolean, Text
from sqlalchemy.orm import relationship
from app.models.base import BaseModel


class VesselSchedule(BaseModel):
    __tablename__ = "vessel_schedules"

    vessel_name = Column(String(100), nullable=False, index=True)
    reconciliation_records = relationship("ReconciliationRecord", back_populates="vessel_schedule")
    vessel_imo = Column(String(20), index=True)
    voyage_number = Column(String(50))
    
    draft = Column(Float, nullable=False)
    deadweight = Column(Float)
    
    eta = Column(DateTime, nullable=False)
    etd = Column(DateTime)
    etb = Column(DateTime)
    ets = Column(DateTime)
    
    service_type = Column(String(50))
    terminal = Column(String(100))
    berth_number = Column(String(20))
    
    cargo_type = Column(String(100))
    cargo_quantity = Column(Float)
    
    is_cut_in = Column(Boolean, default=False)
    cut_in_reason = Column(Text)
    
    status = Column(String(50), default="scheduled")
    source_file = Column(String(255))
    batch_id = Column(String(100), index=True)
    
    notes = Column(Text)
