from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class TrafficModel(Base):
    __tablename__ = "traffic_models"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    model_type = Column(String(50), nullable=False)
    
    virtual_users = Column(Integer, nullable=False)
    ramp_up_seconds = Column(Integer, default=0)
    duration_seconds = Column(Integer, nullable=False)
    
    think_time_min_ms = Column(Integer, nullable=True)
    think_time_max_ms = Column(Integer, nullable=True)
    
    distribution_pattern = Column(String(50), default="uniform")
    
    interface_distribution = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    project = relationship("Project", back_populates="traffic_models")
    load_test_batches = relationship("LoadTestBatch", back_populates="traffic_model")
