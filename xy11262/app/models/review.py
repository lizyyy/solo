import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from app.core.database import Base


class ReviewResult(str, enum.Enum):
    PASS = "pass"
    FAIL = "fail"
    NEED_RECTIFY = "need_rectify"


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    hazard_id = Column(Integer, ForeignKey("hazards.id"), nullable=False)
    
    reviewer = Column(String(100))
    reviewer_phone = Column(String(20))
    reviewed_at = Column(DateTime, default=datetime.utcnow)
    
    result = Column(Enum(ReviewResult), nullable=False)
    is_passed = Column(Boolean, default=False)
    
    comments = Column(Text)
    suggestions = Column(Text)
    
    next_review_date = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    hazard = relationship("Hazard", back_populates="reviews")
