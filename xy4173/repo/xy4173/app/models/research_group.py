from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base


class ResearchGroup(Base):
    """课题组"""
    __tablename__ = "research_groups"
    
    id = Column(Integer, primary_key=True, index=True)
    group_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    principal_investigator = Column(String(100), nullable=True)
    
    department = Column(String(100), nullable=True)
    contact_email = Column(String(100), nullable=True)
    
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    members = relationship("User", back_populates="research_group")
    reservations = relationship("Reservation", back_populates="research_group")
