from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Review(Base):
    """复核记录"""
    __tablename__ = "reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    review_code = Column(String(50), unique=True, index=True, nullable=False)
    
    violation_id = Column(Integer, ForeignKey("violations.id"), nullable=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=True)
    reservation_id = Column(Integer, ForeignKey("reservations.id"), nullable=True)
    
    reviewer_id = Column(String(50), nullable=False)
    reviewer_name = Column(String(100), nullable=True)
    
    review_type = Column(String(50), nullable=False)
    
    review_action = Column(String(50), nullable=False)
    
    comments = Column(Text, nullable=True)
    
    is_approved = Column(Boolean, default=False)
    
    reviewed_at = Column(DateTime, default=datetime.now)
    
    previous_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=True)
    
    import_batch_id = Column(Integer, ForeignKey("import_batches.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    violation = relationship("Violation", back_populates="reviews")
