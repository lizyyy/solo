from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class GateOperationLog(Base):
    __tablename__ = "gate_operation_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    flight_number = Column(String(20), index=True, nullable=False)
    
    gate_number = Column(String(10))
    stand_number = Column(String(10))
    
    arrival_time = Column(DateTime)
    departure_time = Column(DateTime)
    
    gate_available_time = Column(DateTime)
    gate_occupied_time = Column(DateTime)
    
    operation_type = Column(String(20))
    operation_status = Column(String(20))
    
    deice_available_time = Column(DateTime)
    deice_completed_time = Column(DateTime)
    
    crew_ready_time = Column(DateTime)
    boarding_completed_time = Column(DateTime)
    
    baggage_loaded_time = Column(DateTime)
    fuel_loaded_time = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
            "flight_number": self.flight_number,
            "gate_number": self.gate_number,
            "stand_number": self.stand_number,
            "arrival_time": self.arrival_time.isoformat() if self.arrival_time else None,
            "departure_time": self.departure_time.isoformat() if self.departure_time else None,
            "gate_available_time": self.gate_available_time.isoformat() if self.gate_available_time else None,
            "gate_occupied_time": self.gate_occupied_time.isoformat() if self.gate_occupied_time else None,
            "operation_type": self.operation_type,
            "operation_status": self.operation_status,
            "deice_available_time": self.deice_available_time.isoformat() if self.deice_available_time else None,
            "deice_completed_time": self.deice_completed_time.isoformat() if self.deice_completed_time else None,
            "crew_ready_time": self.crew_ready_time.isoformat() if self.crew_ready_time else None,
            "boarding_completed_time": self.boarding_completed_time.isoformat() if self.boarding_completed_time else None,
            "baggage_loaded_time": self.baggage_loaded_time.isoformat() if self.baggage_loaded_time else None,
            "fuel_loaded_time": self.fuel_loaded_time.isoformat() if self.fuel_loaded_time else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
