from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class DeliveryStatus(str, enum.Enum):
    PENDING = "pending"
    DISPATCHED = "dispatched"
    DELIVERED = "delivered"
    FAILED = "failed"
    RETURNED = "returned"


class Delivery(Base):
    __tablename__ = "deliveries"

    id = Column(Integer, primary_key=True, index=True)
    delivery_batch_id = Column(String(100), index=True)
    
    elderly_id = Column(Integer, ForeignKey("elderly.id"), nullable=False)
    meal_allocation_id = Column(Integer, ForeignKey("meal_allocations.id"))
    
    delivery_date = Column(Date, nullable=False, index=True)
    meal_type = Column(String(20))
    
    route = Column(String(100))
    sequence = Column(Integer)
    
    status = Column(Enum(DeliveryStatus), default=DeliveryStatus.PENDING)
    
    delivered_by = Column(String(100))
    delivered_at = Column(DateTime(timezone=True))
    
    received_by = Column(String(100))
    signature = Column(String(200))
    
    failure_reason = Column(Text)
    
    temperature = Column(String(50))
    packaging_condition = Column(String(100))
    
    notes = Column(Text)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    elderly = relationship("Elderly")
    meal_allocation = relationship("MealAllocation")
