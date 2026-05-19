from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON
from sqlalchemy.sql import func
from app.core.database import Base


class Elderly(Base):
    __tablename__ = "elderly"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    gender = Column(String(10))
    age = Column(Integer)
    phone = Column(String(20), unique=True, index=True)
    id_card = Column(String(18), unique=True)
    address = Column(String(500))
    room_number = Column(String(50))
    
    dietary_restrictions = Column(JSON, default=list)
    chronic_diseases = Column(JSON, default=list)
    
    emergency_contact = Column(String(100))
    emergency_phone = Column(String(20))
    
    delivery_route = Column(String(100))
    delivery_sequence = Column(Integer)
    
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
