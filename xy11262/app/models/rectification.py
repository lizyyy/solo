from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class Rectification(Base):
    __tablename__ = "rectifications"

    id = Column(Integer, primary_key=True, index=True)
    hazard_id = Column(Integer, ForeignKey("hazards.id"), nullable=False)
    
    rectifier = Column(String(100))
    rectifier_phone = Column(String(20))
    
    action_taken = Column(Text)
    measures = Column(Text)
    cost = Column(Integer, default=0)
    
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    
    remarks = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    hazard = relationship("Hazard", back_populates="rectifications")
