from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class MealStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    MODIFIED = "modified"
    CANCELLED = "cancelled"
    DELIVERED = "delivered"


class MealType(str, enum.Enum):
    BREAKFAST = "breakfast"
    LUNCH = "lunch"
    DINNER = "dinner"


class MealAllocation(Base):
    __tablename__ = "meal_allocations"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String(100), unique=True, index=True)
    
    elderly_id = Column(Integer, ForeignKey("elderly.id"), nullable=False)
    menu_date = Column(Date, nullable=False, index=True)
    meal_type = Column(Enum(MealType), nullable=False)
    
    status = Column(Enum(MealStatus), default=MealStatus.PENDING)
    
    allocated_items = Column(String(1000))
    conflicts = Column(Text)
    has_conflict = Column(Integer, default=0)
    
    modified_by = Column(String(100))
    modified_at = Column(DateTime(timezone=True))
    modified_reason = Column(Text)
    
    notes = Column(Text)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    elderly = relationship("Elderly")
