from sqlalchemy import Column, String, Integer, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from .base import Base

class MaintenanceProvider(Base):
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    contact_person = Column(String(100))
    contact_phone = Column(String(20))
    region_id = Column(Integer, ForeignKey('regions.id'))
    is_active = Column(Boolean, default=True)

    region = relationship("Region", back_populates="maintenance_providers")
    dispatches = relationship("Dispatch", back_populates="provider")
