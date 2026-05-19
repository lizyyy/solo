from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class SatisfactionLevel(str, enum.Enum):
    VERY_GOOD = "very_good"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"
    VERY_POOR = "very_poor"


class FollowUp(Base):
    __tablename__ = "follow_ups"

    id = Column(Integer, primary_key=True, index=True)
    
    elderly_id = Column(Integer, ForeignKey("elderly.id"), nullable=False)
    delivery_id = Column(Integer, ForeignKey("deliveries.id"))
    
    follow_up_date = Column(Date, nullable=False, index=True)
    
    food_quality = Column(Enum(SatisfactionLevel))
    temperature = Column(Enum(SatisfactionLevel))
    packaging = Column(Enum(SatisfactionLevel))
    delivery_service = Column(Enum(SatisfactionLevel))
    
    overall_satisfaction = Column(Enum(SatisfactionLevel))
    
    complaints = Column(Text)
    suggestions = Column(Text)
    
    dietary_feedback = Column(Text)
    
    followed_by = Column(String(100))
    follow_up_method = Column(String(50))
    
    needs_further_action = Column(Integer, default=0)
    action_taken = Column(Text)
    
    notes = Column(Text)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    elderly = relationship("Elderly")
    delivery = relationship("Delivery")
