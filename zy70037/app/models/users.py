from sqlalchemy import Column, String, Boolean
from sqlalchemy.orm import relationship
from .base import Base

class User(Base):
    username = Column(String(100), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    phone = Column(String(20))
    email = Column(String(255))
    role = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True)

    managed_stores = relationship("Store", back_populates="manager")
    managed_regions = relationship("Region", back_populates="manager")
    dispatches = relationship("Dispatch", back_populates="maintenance_worker")
    repair_receipts = relationship("RepairReceipt", back_populates="worker")
