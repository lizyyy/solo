from sqlalchemy import Column, String, Integer, Float, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from .base import Base

class Freezer(Base):
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    store_id = Column(Integer, ForeignKey('stores.id'), nullable=False)
    model = Column(String(100))
    min_temperature = Column(Float, default=-20.0)
    max_temperature = Column(Float, default=5.0)
    is_active = Column(Boolean, default=True)

    store = relationship("Store", back_populates="freezers")
    temperature_events = relationship("TemperatureEvent", back_populates="freezer")
