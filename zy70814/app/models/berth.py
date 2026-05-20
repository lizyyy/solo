from sqlalchemy import Column, String, Float, Integer, Boolean, Text, DateTime
from sqlalchemy.orm import relationship
from app.models.base import BaseModel


class Berth(BaseModel):
    __tablename__ = "berths"

    berth_number = Column(String(20), nullable=False, index=True)
    reconciliation_records = relationship("ReconciliationRecord", back_populates="berth")
    terminal = Column(String(100))
    description = Column(String(255))
    
    depth_at_mllw = Column(Float, nullable=False)
    max_draft = Column(Float)
    min_depth = Column(Float)
    
    length = Column(Float)
    max_vessel_length = Column(Float)
    
    is_available = Column(Boolean, default=True)
    unavailable_reason = Column(Text)
    unavailable_from = Column(DateTime)
    unavailable_to = Column(DateTime)
    
    allowed_vessel_types = Column(String(255))
    allowed_cargo_types = Column(String(255))
    
    priority = Column(Integer, default=0)
    source_file = Column(String(255))
    batch_id = Column(String(100), index=True)
    
    notes = Column(Text)
