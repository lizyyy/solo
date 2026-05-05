from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class DeiceFluidRecord(Base):
    __tablename__ = "deice_fluid_records"
    
    id = Column(Integer, primary_key=True, index=True)
    flight_number = Column(String(20), index=True, nullable=False)
    
    batch_number = Column(String(50), nullable=False)
    fluid_type = Column(String(20))
    
    measured_concentration = Column(Float, nullable=False)
    target_concentration = Column(Float)
    temperature_applied = Column(Float)
    
    application_start_time = Column(DateTime)
    application_end_time = Column(DateTime)
    
    total_volume_used = Column(Float)
    technician_name = Column(String(100))
    
    is_second_deicing = Column(Integer, default=0)
    previous_deice_id = Column(Integer, ForeignKey("deice_fluid_records.id"))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
            "flight_number": self.flight_number,
            "batch_number": self.batch_number,
            "fluid_type": self.fluid_type,
            "measured_concentration": self.measured_concentration,
            "target_concentration": self.target_concentration,
            "temperature_applied": self.temperature_applied,
            "application_start_time": self.application_start_time.isoformat() if self.application_start_time else None,
            "application_end_time": self.application_end_time.isoformat() if self.application_end_time else None,
            "total_volume_used": self.total_volume_used,
            "technician_name": self.technician_name,
            "is_second_deicing": self.is_second_deicing,
            "previous_deice_id": self.previous_deice_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
