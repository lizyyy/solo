import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class PhotoType(str, enum.Enum):
    INSPECTION = "inspection"
    RECTIFICATION = "rectification"
    REVIEW = "review"


class Photo(Base):
    __tablename__ = "photos"

    id = Column(Integer, primary_key=True, index=True)
    hazard_id = Column(Integer, ForeignKey("hazards.id"), nullable=False)
    photo_type = Column(Enum(PhotoType), default=PhotoType.INSPECTION)
    
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer)
    
    taken_by = Column(String(100))
    taken_at = Column(DateTime)
    
    description = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    hazard = relationship("Hazard", back_populates="photos")
