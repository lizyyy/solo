from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base

class Region(Base):
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    manager_id = Column(Integer, ForeignKey('users.id'))
    parent_region_id = Column(Integer, ForeignKey('regions.id'), nullable=True)

    manager = relationship("User", back_populates="managed_regions")
    stores = relationship("Store", back_populates="region")
    maintenance_providers = relationship("MaintenanceProvider", back_populates="region")
