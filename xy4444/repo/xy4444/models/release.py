from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class FlightRelease(Base):
    __tablename__ = "flight_releases"
    
    id = Column(Integer, primary_key=True, index=True)
    flight_number = Column(String(20), unique=True, index=True, nullable=False)
    
    hold_time_minutes = Column(Integer)
    hold_time_expiry = Column(DateTime)
    hold_time_status = Column(String(20))
    
    concentration_deviation = Column(Float)
    concentration_status = Column(String(20))
    target_concentration = Column(Float)
    measured_concentration = Column(Float)
    
    is_second_deicing_required = Column(Boolean, default=False)
    second_deicing_reason = Column(String(200))
    deice_rounds = Column(Integer, default=0)
    
    gate_conflict_risk = Column(String(20))
    gate_conflict_details = Column(Text)
    overlapping_flights = Column(Text)
    
    release_status = Column(String(20), default="pending")
    
    review_comments = Column(Text)
    reviewed_by = Column(String(100))
    reviewed_at = Column(DateTime)
    
    override_decision = Column(String(20))
    override_reason = Column(Text)
    overridden_by = Column(String(100))
    overridden_at = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
            "flight_number": self.flight_number,
            "hold_time_minutes": self.hold_time_minutes,
            "hold_time_expiry": self.hold_time_expiry.isoformat() if self.hold_time_expiry else None,
            "hold_time_status": self.hold_time_status,
            "concentration_deviation": self.concentration_deviation,
            "concentration_status": self.concentration_status,
            "target_concentration": self.target_concentration,
            "measured_concentration": self.measured_concentration,
            "is_second_deicing_required": self.is_second_deicing_required,
            "second_deicing_reason": self.second_deicing_reason,
            "deice_rounds": self.deice_rounds,
            "gate_conflict_risk": self.gate_conflict_risk,
            "gate_conflict_details": self.gate_conflict_details,
            "overlapping_flights": self.overlapping_flights,
            "release_status": self.release_status,
            "review_comments": self.review_comments,
            "reviewed_by": self.reviewed_by,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "override_decision": self.override_decision,
            "override_reason": self.override_reason,
            "overridden_by": self.overridden_by,
            "overridden_at": self.overridden_at.isoformat() if self.overridden_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
