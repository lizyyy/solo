from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Interface(Base):
    __tablename__ = "interfaces"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    
    name = Column(String(255), nullable=False)
    method = Column(String(10), nullable=False)
    path = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    
    request_headers = Column(JSON, nullable=True)
    request_body = Column(Text, nullable=True)
    request_params = Column(JSON, nullable=True)
    response_schema = Column(JSON, nullable=True)
    
    expected_response_time_ms = Column(Integer, nullable=True)
    priority = Column(String(20), default="medium")
    tags = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    project = relationship("Project", back_populates="interfaces")
