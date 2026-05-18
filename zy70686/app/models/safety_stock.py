from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class SafetyStock(Base):
    __tablename__ = "safety_stocks"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    min_stock = Column(Float, nullable=False)
    max_stock = Column(Float, nullable=False)
    reorder_point = Column(Float, nullable=False)
    forecast_days = Column(Integer, default=7)
    safety_factor = Column(Float, default=1.5)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    store = relationship("Store", back_populates="safety_stocks")
    material = relationship("Material", back_populates="safety_stocks")
