from sqlalchemy import Column, Integer, String, DateTime, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Store(Base):
    __tablename__ = "stores"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    address = Column(String(255))
    manager = Column(String(100))
    phone = Column(String(20))
    status = Column(String(20), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    safety_stocks = relationship("SafetyStock", back_populates="store")
    sales_records = relationship("SalesRecord", back_populates="store")
    replenishment_orders = relationship("ReplenishmentOrder", back_populates="store")
    alert_reports = relationship("AlertReport", back_populates="store")
