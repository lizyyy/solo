from sqlalchemy import Column, Integer, String, DateTime, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    category = Column(String(50), nullable=False, index=True)
    unit = Column(String(20), nullable=False)
    current_stock = Column(Float, default=0.0)
    unit_price = Column(Float, default=0.0)
    supplier = Column(String(100))
    lead_time_days = Column(Integer, default=3)
    status = Column(String(20), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    safety_stocks = relationship("SafetyStock", back_populates="material")
    sales_records = relationship("SalesRecord", back_populates="material")
    replenishment_orders = relationship("ReplenishmentOrder", back_populates="material")
    alert_reports = relationship("AlertReport", back_populates="material")
