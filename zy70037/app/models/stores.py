from sqlalchemy import Column, String, Integer, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from .base import Base

class Store(Base):
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    address = Column(String(500))
    region_id = Column(Integer, ForeignKey('regions.id'))
    manager_id = Column(Integer, ForeignKey('users.id'))
    contact_phone = Column(String(20))
    is_active = Column(Boolean, default=True)

    region = relationship("Region", back_populates="stores")
    manager = relationship("User", back_populates="managed_stores")
    freezers = relationship("Freezer", back_populates="store")
