import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, Float, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class HazardStatus(str, enum.Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    RECTIFYING = "rectifying"
    REVIEWING = "reviewing"
    CLOSED = "closed"
    REJECTED = "rejected"


class HazardLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Hazard(Base):
    __tablename__ = "hazards"

    id = Column(Integer, primary_key=True, index=True)
    hazard_code = Column(String(50), unique=True, index=True, nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    location = Column(String(500))
    level = Column(Enum(HazardLevel), default=HazardLevel.MEDIUM)
    status = Column(Enum(HazardStatus), default=HazardStatus.PENDING)
    
    discovered_by = Column(String(100))
    discovered_at = Column(DateTime, default=datetime.utcnow)
    
    department = Column(String(100))
    category = Column(String(100))
    
    responsible_person = Column(String(100))
    responsible_phone = Column(String(20))
    deadline = Column(DateTime)
    
    closed_at = Column(DateTime)
    closed_by = Column(String(100))
    
    remarks = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    photos = relationship("Photo", back_populates="hazard", cascade="all, delete-orphan")
    rectifications = relationship("Rectification", back_populates="hazard", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="hazard", cascade="all, delete-orphan")
