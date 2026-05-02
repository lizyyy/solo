from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class User(Base):
    """系统用户（管理员、老师、学生）"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    card_number = Column(String(50), unique=True, index=True, nullable=True)
    
    role = Column(String(20), default="student")
    email = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    
    research_group_id = Column(Integer, ForeignKey("research_groups.id"), nullable=True)
    
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    research_group = relationship("ResearchGroup", back_populates="members")
    reservations = relationship("Reservation", back_populates="user")
    swipe_logs = relationship("SwipeLog", back_populates="user")
    samples = relationship("SampleRegistration", back_populates="user")
    bills = relationship("Bill", back_populates="user")
