from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class ReplenishmentOrder(Base):
    __tablename__ = "replenishment_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, index=True, nullable=False)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    status = Column(String(20), default="pending", index=True)
    priority = Column(String(20), default="normal")
    estimated_arrival = Column(DateTime)
    actual_arrival = Column(DateTime)
    remarks = Column(Text)
    need_manual_review = Column(Integer, default=0)
    review_reason = Column(String(255))
    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    store = relationship("Store", back_populates="replenishment_orders")
    material = relationship("Material", back_populates="replenishment_orders")
