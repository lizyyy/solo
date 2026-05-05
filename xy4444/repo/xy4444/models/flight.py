from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean
from database import Base
from datetime import datetime


class FlightPlan(Base):
    __tablename__ = "flight_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    flight_number = Column(String(20), unique=True, index=True, nullable=False)
    
    aircraft_type = Column(String(50))
    aircraft_registration = Column(String(20))
    
    departure_airport = Column(String(10))
    arrival_airport = Column(String(10))
    
    scheduled_departure = Column(DateTime)
    estimated_departure = Column(DateTime)
    actual_departure = Column(DateTime)
    
    gate_number = Column(String(10))
    stand_number = Column(String(10))
    
    is_deice_required = Column(Boolean, default=False)
    deice_priority = Column(Integer, default=3)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
            "flight_number": self.flight_number,
            "aircraft_type": self.aircraft_type,
            "aircraft_registration": self.aircraft_registration,
            "departure_airport": self.departure_airport,
            "arrival_airport": self.arrival_airport,
            "scheduled_departure": self.scheduled_departure.isoformat() if self.scheduled_departure else None,
            "estimated_departure": self.estimated_departure.isoformat() if self.estimated_departure else None,
            "actual_departure": self.actual_departure.isoformat() if self.actual_departure else None,
            "gate_number": self.gate_number,
            "stand_number": self.stand_number,
            "is_deice_required": self.is_deice_required,
            "deice_priority": self.deice_priority,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
