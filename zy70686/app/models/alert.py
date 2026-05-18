from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class AlertReport(Base):
    __tablename__ = "alert_reports"

    id = Column(Integer, primary_key=True, index=True)
    alert_no = Column(String(50), unique=True, index=True, nullable=False)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    alert_type = Column(String(50), nullable=False, index=True)
    alert_level = Column(String(20), default="warning")
    current_stock = Column(Float, nullable=False)
    forecast_consumption = Column(Float, nullable=False)
    estimated_runout_days = Column(Float)
    status = Column(String(20), default="pending", index=True)
    merged_from = Column(String(255))
    remarks = Column(Text)
    handled_by = Column(String(100))
    handled_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    store = relationship("Store", back_populates="alert_reports")
    material = relationship("Material", back_populates="alert_reports")
