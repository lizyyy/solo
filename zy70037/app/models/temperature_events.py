from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from .base import Base

class TemperatureEvent(Base):
    freezer_id = Column(Integer, ForeignKey('freezers.id'), nullable=False)
    temperature = Column(Float, nullable=False)
    event_type = Column(String(50), nullable=False)
    status = Column(String(50), default='pending', nullable=False)
    detected_at = Column(DateTime, nullable=False)
    resolved_at = Column(DateTime, nullable=True)
    description = Column(Text, nullable=True)

    freezer = relationship("Freezer", back_populates="temperature_events")
    dispatches = relationship("Dispatch", back_populates="temperature_event")
