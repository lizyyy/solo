from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from .base import Base

class Dispatch(Base):
    temperature_event_id = Column(Integer, ForeignKey('temperatureevents.id'), nullable=False)
    provider_id = Column(Integer, ForeignKey('maintenanceproviders.id'), nullable=False)
    worker_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    dispatch_code = Column(String(50), unique=True, nullable=False)
    status = Column(String(50), default='pending', nullable=False)
    priority = Column(String(20), default='normal')
    dispatched_at = Column(DateTime, nullable=True)
    accepted_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    target_time = Column(DateTime, nullable=True)
    escalation_level = Column(Integer, default=0)
    notes = Column(Text, nullable=True)

    temperature_event = relationship("TemperatureEvent", back_populates="dispatches")
    provider = relationship("MaintenanceProvider", back_populates="dispatches")
    maintenance_worker = relationship("User", back_populates="dispatches")
    repair_receipts = relationship("RepairReceipt", back_populates="dispatch")
    escalations = relationship("Escalation", back_populates="dispatch")
